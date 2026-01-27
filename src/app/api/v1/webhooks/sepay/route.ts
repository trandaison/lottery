import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { campaigns, orders, orderTickets, users } from '@/db/schema';
import { verifyWebhookJWT } from '@/services/payment.server';
import {
  reconcilePayment,
  type SepayWebhookPayload,
} from '@/services/payment.service';
import { ticketService } from '@/services/ticket.service';
import { emailService } from '@/services/email.service';
import { userService } from '@/services/user.service';
import { campaignService } from '@/services/campaign.service';

/**
 * SePay Webhook Endpoint
 *
 * Handles payment notifications from SePay payment gateway.
 * Implements JWT authentication, payment reconciliation, and ticket generation.
 *
 * Flow:
 * 1. Extract and verify JWT from Authorization header
 * 2. Find campaign by UUID from JWT subject
 * 3. Extract and validate webhook payload
 * 4. Find order by payment reference ID
 * 5. Check idempotency (already processed)
 * 6. Reconcile payment (amount + account number)
 * 7. If successful, update order and create tickets
 *
 * POST /api/v1/webhooks/sepay
 * Headers: Authorization: Apikey {JWT_TOKEN}
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Extract JWT from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Apikey ')) {
      console.error('[Webhook] Missing or invalid Authorization header');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 203 },
      );
    }

    const token = authHeader.replace('Apikey ', '');

    // 2. Verify JWT and get campaign UUID
    const decoded = verifyWebhookJWT(token);
    if (!decoded || !decoded.sub) {
      console.error('[Webhook] Invalid JWT token');
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 203 },
      );
    }

    const campaignUuid = decoded.sub;
    console.log(`[Webhook] Verified JWT for campaign UUID: ${campaignUuid}`);

    // 3. Find campaign by UUID (any status is acceptable)
    const campaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.uuid, campaignUuid),
    });

    if (!campaign) {
      console.error(`[Webhook] Campaign not found for UUID: ${campaignUuid}`);
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 203 },
      );
    }

    // 4. Extract webhook payload
    let payload: SepayWebhookPayload;
    try {
      payload = await request.json();
    } catch (error) {
      console.error('[Webhook] Invalid JSON payload:', error);
      return NextResponse.json(
        { error: 'Invalid payload format' },
        { status: 400 },
      );
    }

    // Validate required fields
    if (!payload.code || !payload.transferAmount || !payload.accountNumber) {
      console.error('[Webhook] Missing required fields in payload:', payload);
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    console.log('[Webhook] Payload received:', {
      code: payload.code,
      amount: payload.transferAmount,
      accountNumber: payload.accountNumber,
      transactionDate: payload.transactionDate,
      referenceCode: payload.referenceCode,
    });

    // 5. Find order by payment reference ID
    const order = await db.query.orders.findFirst({
      where: eq(orders.paymentReferenceId, payload.code),
    });

    if (!order) {
      console.error(`[Webhook] Order not found for reference: ${payload.code}`);
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 203 },
      );
    }

    console.log(`[Webhook] Found order ID: ${order.id}, status: ${order.paymentStatus}`);

    // 6. Check if already processed (idempotency)
    if (order.paymentStatus === 'success') {
      console.log(
        `[Webhook] Order ${payload.code} already processed, returning 208 (idempotency)`,
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
      console.error('[Webhook] Reconciliation failed:', {
        orderId: order.id,
        errors: reconciliation.errors,
        expectedAmount: order.totalAmount,
        receivedAmount: payload.transferAmount,
        expectedAccount: campaign.accountNumber,
        receivedAccount: payload.accountNumber,
      });

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
      console.log(`[Webhook] Processing payment for order ${order.id}`);

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
      const ticketNumbers = await ticketService.generateUniqueTicketNumbers(
        order.campaignId,
        order.ticketsCount,
      );

      // Create tickets in database using ticket service
      const createdTickets = await ticketService.createTickets(
        ticketNumbers.map((ticketNumber) => ({
          campaignId: order.campaignId,
          userId: order.userId,
          ticketNumber,
        })),
      );

      // Link tickets to order via order_tickets
      await db.insert(orderTickets).values(
        createdTickets.map((ticket) => ({
          orderId: order.id,
          ticketId: ticket.id,
        })),
      );

      console.log(
        `[Webhook] Successfully processed order ${payload.code}: ` +
        `created ${createdTickets.length} tickets, ` +
        `order ID: ${order.id}, ` +
        `ticket numbers: ${ticketNumbers.join(', ')}`,
      );

      // Trigger email notification (Phase 7)
      // Fetch user and campaign data for email
      try {
        const [user, campaign] = await Promise.all([
          userService.getById(order.userId),
          campaignService.getById(order.campaignId),
        ]);

        if (user && campaign) {
          // Send email asynchronously (don't wait for it to complete)
          emailService
            .sendTicketEmail(order, user, campaign, createdTickets)
            .catch((error) => {
              console.error('[Webhook] Failed to send email:', error);
              // Don't fail the webhook if email fails
            });
        } else {
          console.warn(
            `[Webhook] Cannot send email: user or campaign not found (userId: ${order.userId}, campaignId: ${order.campaignId})`,
          );
        }
      } catch (emailError) {
        console.error('[Webhook] Error preparing email:', emailError);
        // Don't fail the webhook if email preparation fails
      }

      return NextResponse.json(
        {
          message: 'Payment processed successfully',
          tickets: createdTickets.length,
          orderId: order.id,
        },
        { status: 200 },
      );
    }

    // If order status is failed, should not happen but handle gracefully
    console.warn(
      `[Webhook] Order ${order.id} in unexpected state: ${order.paymentStatus}`,
    );
    return NextResponse.json(
      { error: 'Order in invalid state' },
      { status: 203 },
    );
  } catch (error) {
    console.error('[Webhook] Processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
