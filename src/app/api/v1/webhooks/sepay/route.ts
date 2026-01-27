import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { campaigns, orders, tickets, orderTickets } from '@/db/schema';
import { verifyWebhookJWT } from '@/services/payment.server';
import {
  reconcilePayment,
  type SepayWebhookPayload,
} from '@/services/payment.service';

/**
 * SePay Webhook Endpoint
 * Handles payment notifications from SePay
 * POST /api/v1/webhooks/sepay
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Extract JWT from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Apikey ')) {
      console.error('Missing or invalid Authorization header');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 203 },
      );
    }

    const token = authHeader.replace('Apikey ', '');

    // 2. Verify JWT and get campaign UUID
    const decoded = verifyWebhookJWT(token);
    if (!decoded || !decoded.sub) {
      console.error('Invalid JWT token');
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 203 },
      );
    }

    const campaignUuid = decoded.sub;

    // 3. Find campaign by UUID (any status is acceptable)
    const campaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.uuid, campaignUuid),
    });

    if (!campaign) {
      console.error(`Campaign not found for UUID: ${campaignUuid}`);
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 203 },
      );
    }

    // 4. Extract webhook payload
    const payload: SepayWebhookPayload = await request.json();
    console.log('Webhook payload received:', {
      code: payload.code,
      amount: payload.transferAmount,
      transactionDate: payload.transactionDate,
    });

    // 5. Find order by payment reference ID
    const order = await db.query.orders.findFirst({
      where: eq(orders.paymentReferenceId, payload.code),
    });

    if (!order) {
      console.error(`Order not found for reference: ${payload.code}`);
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 203 },
      );
    }

    // 6. Check if already processed (idempotency)
    if (order.paymentStatus === 'success') {
      console.log(
        `Order ${payload.code} already processed, returning 208`,
      );
      return NextResponse.json(
        { message: 'Already processed' },
        { status: 208 },
      );
    }

    // 7. Reconcile transaction
    const reconciliation = reconcilePayment(
      payload,
      order.totalAmount,
      campaign.accountNumber || '',
    );

    // 8. If reconciliation fails
    if (!reconciliation.success) {
      console.error('Reconciliation failed:', reconciliation.errors);

      await db
        .update(orders)
        .set({
          paymentStatus: 'failed',
          errorMessage: JSON.stringify({
            ...payload,
            reconciliationResult: reconciliation.errors,
          }),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));

      return NextResponse.json(
        { error: 'Reconciliation failed', details: reconciliation.errors },
        { status: 203 },
      );
    }

    // 9. If reconciliation succeeds and order is pending
    if (order.paymentStatus === 'pending') {
      // Update order status
      await db
        .update(orders)
        .set({
          paymentStatus: 'success',
          sepayTransactionId: payload.referenceCode,
          receivedAt: new Date(),
          transactionDate: new Date(payload.transactionDate),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));

      // Generate unique ticket numbers using ticket service
      const { ticketService } = await import('@/services/ticket.service');
      const ticketNumbers = await ticketService.generateUniqueTicketNumbers(
        order.campaignId,
        order.ticketsCount
      );

      // Create tickets in database using ticket service
      const createdTickets = await ticketService.createTickets(
        ticketNumbers.map((ticketNumber) => ({
          campaignId: order.campaignId,
          userId: order.userId,
          ticketNumber,
        }))
      );

      // Link tickets to order via order_tickets
      await db.insert(orderTickets).values(
        createdTickets.map((ticket) => ({
          orderId: order.id,
          ticketId: ticket.id,
        })),
      );

      console.log(
        `Successfully processed order ${payload.code}, created ${createdTickets.length} tickets`,
      );

      // TODO: Trigger email job (Phase 7)
      // await emailService.sendTicketEmail(order, createdTickets);

      return NextResponse.json(
        {
          message: 'Payment processed successfully',
          tickets: createdTickets.length,
        },
        { status: 200 },
      );
    }

    // If order status is failed, should not happen but handle gracefully
    return NextResponse.json(
      { error: 'Order in invalid state' },
      { status: 203 },
    );
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

