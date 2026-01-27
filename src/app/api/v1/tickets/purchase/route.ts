import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { userService } from '@/services/user.service';
import { orderService } from '@/services/order.service';
import { campaignService } from '@/services/campaign.service';
import { ticketService } from '@/services/ticket.service';
import { emailService } from '@/services/email.service';
import { generateQRUrl } from '@/services/payment.service';
import type { ApiResponse } from '@/types';

/**
 * Purchase request schema
 */
const purchaseRequestSchema = z.object({
  campaignSlug: z.string().min(1, 'Campaign slug is required'),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^0\d{9}$/, 'Phone must be 10 digits starting with 0'),
  ticketsCount: z.number().int().min(1).max(100, 'Cannot purchase more than 100 tickets at once'),
});

interface RouteContext {
  params: Promise<Record<string, never>>;
}

/**
 * POST /api/v1/tickets/purchase
 * Purchase tickets for a campaign
 *
 * Flow:
 * 1. Validate input (Zod)
 * 2. Check campaign status = 'active'
 * 3. Check current time within campaign start/end
 * 4. Find/create user by email
 * 5. Create order (payment_status = 'pending', id/uuid generated)
 * 6. Generate payment_reference_id
 * 7. Set expires_at (now + 10 min, for transfer only)
 *
 * IF payment_type = 'direct':
 *   8a. Set payment_status = 'success'
 *   8b. Generate unique ticket numbers
 *   8c. Create tickets in DB (id/uuid auto-generated)
 *   8d. Create order_tickets (ticket_id FK)
 *   8e. Trigger email job (TODO: Phase 7)
 *   8f. Return order with tickets
 *
 * IF payment_type = 'transfer':
 *   8a. Generate QR URL
 *   8b. Return payment info + QR URL
 *   8c. Client will poll for status updates
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // 1. Validate input
    const body = await request.json();
    const validatedData = purchaseRequestSchema.parse(body);

    // 2. Get campaign by slug
    const campaign = await campaignService.getBySlug(validatedData.campaignSlug);
    if (!campaign) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'CAMPAIGN_NOT_FOUND',
            message: 'Campaign không tồn tại',
          },
        },
        { status: 404 }
      );
    }

    // 3. Check campaign status = 'active'
    if (campaign.status !== 'active') {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'CAMPAIGN_NOT_ACTIVE',
            message: 'Campaign không khả dụng',
          },
        },
        { status: 400 }
      );
    }

    // 4. Check current time within campaign start/end
    const now = new Date();
    if (now < campaign.startTime) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'CAMPAIGN_NOT_STARTED',
            message: 'Campaign chưa bắt đầu',
          },
        },
        { status: 400 }
      );
    }

    if (now > campaign.endTime) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'CAMPAIGN_ENDED',
            message: 'Campaign đã kết thúc',
          },
        },
        { status: 400 }
      );
    }

    // 5. Find/create user by email
    const user = await userService.findOrCreate(validatedData.email, {
      name: validatedData.name,
      phone: validatedData.phone,
    });

    // 6. Calculate total amount
    const totalAmount = campaign.ticketPrice * validatedData.ticketsCount;

    // 7. Create order
    const order = await orderService.create({
      campaignId: campaign.id,
      userId: user.id,
      ticketsCount: validatedData.ticketsCount,
      totalAmount,
      paymentType: campaign.paymentType,
    });

    // 8. Handle payment based on type
    if (campaign.paymentType === 'direct') {
      // 8a. Set payment_status = 'success'
      await orderService.updatePaymentStatus(order.id, 'success');

      // 8b-8d. Generate tickets and link to order
      const tickets = await orderService.createTicketsForOrder(order.id);

      // 8e. Trigger email notification (Phase 7)
      // Get full ticket objects for email
      try {
        const fullTickets = await ticketService.getTicketsByOrderId(order.id);
        if (fullTickets.length > 0) {
          // Send email asynchronously (don't wait for it to complete)
          emailService
            .sendTicketEmail(order, user, campaign, fullTickets)
            .catch((error) => {
              console.error('[Purchase] Failed to send email:', error);
              // Don't fail the purchase if email fails
            });
        }
      } catch (emailError) {
        console.error('[Purchase] Error preparing email:', emailError);
        // Don't fail the purchase if email preparation fails
      }

      // 8f. Return order with tickets
      return NextResponse.json<
        ApiResponse<{
          order: {
            id: number;
            uuid: string;
            paymentReferenceId: string;
            totalAmount: number;
            ticketsCount: number;
            paymentType: 'direct';
            paymentStatus: 'success';
            createdAt: Date;
          };
          tickets: Array<{ id: number; ticketNumber: string }>;
        }>
      >({
        success: true,
        data: {
          order: {
            id: order.id,
            uuid: order.uuid,
            paymentReferenceId: order.paymentReferenceId,
            totalAmount: order.totalAmount,
            ticketsCount: order.ticketsCount,
            paymentType: 'direct',
            paymentStatus: 'success',
            createdAt: order.createdAt,
          },
          tickets,
        },
      });
    } else {
      // Transfer payment
      // 8a. Generate QR URL
      if (!campaign.accountNumber || !campaign.bankNameOrCode) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: {
              code: 'PAYMENT_CONFIG_ERROR',
              message: 'Campaign chưa được cấu hình thông tin thanh toán',
            },
          },
          { status: 500 }
        );
      }

      const qrCodeUrl = generateQRUrl(
        campaign.accountNumber,
        campaign.bankNameOrCode,
        order.totalAmount,
        order.paymentReferenceId
      );

      // 8b. Return payment info + QR URL
      return NextResponse.json<
        ApiResponse<{
          order: {
            id: number;
            uuid: string;
            paymentReferenceId: string;
            totalAmount: number;
            ticketsCount: number;
            paymentType: 'transfer';
            paymentStatus: 'pending';
            expiresAt: Date;
            createdAt: Date;
          };
          payment: {
            qrCodeUrl: string;
            bankInfo: {
              bankName: string;
              accountNumber: string;
              amount: number;
              content: string;
            };
          };
        }>
      >({
        success: true,
        data: {
          order: {
            id: order.id,
            uuid: order.uuid,
            paymentReferenceId: order.paymentReferenceId,
            totalAmount: order.totalAmount,
            ticketsCount: order.ticketsCount,
            paymentType: 'transfer',
            paymentStatus: 'pending',
            expiresAt: order.expiresAt!,
            createdAt: order.createdAt,
          },
          payment: {
            qrCodeUrl,
            bankInfo: {
              bankName: campaign.bankNameOrCode,
              accountNumber: campaign.accountNumber,
              amount: order.totalAmount,
              content: order.paymentReferenceId,
            },
          },
        },
      });
    }
  } catch (error) {
    console.error('Purchase error:', error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.errors.map((e) => e.message).join(', '),
          },
        },
        { status: 400 }
      );
    }

    // Handle known service errors
    if (error instanceof Error) {
      const errorCode = error.message.split(':')[0];
      const errorMessage = error.message.split(':')[1]?.trim() || error.message;

      if (errorCode === 'TICKET_GENERATION_FAILED') {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: {
              code: errorCode,
              message: errorMessage,
            },
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process purchase',
        },
      },
      { status: 500 }
    );
  }
}
