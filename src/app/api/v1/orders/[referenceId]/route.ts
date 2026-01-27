import { NextRequest, NextResponse } from 'next/server';
import { orderService } from '@/services/order.service';
import { campaignService } from '@/services/campaign.service';
import type { ApiResponse } from '@/types';

interface RouteContext {
  params: Promise<{ referenceId: string }>;
}

/**
 * GET /api/v1/orders/[referenceId]
 * Get order status by payment reference ID (for polling)
 *
 * Returns order with:
 * - payment_status
 * - tickets (if payment_status = 'success')
 * - error_message (if payment_status = 'failed')
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { referenceId } = await context.params;

    // Get order by payment reference ID
    const order = await orderService.getByPaymentReferenceId(referenceId);

    if (!order) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'ORDER_NOT_FOUND',
            message: 'Order không tồn tại',
          },
        },
        { status: 404 }
      );
    }

    // Get campaign info for QR code generation (for transfer payments)
    const campaign = await campaignService.getById(order.campaignId);

    // Check if order has expired (for transfer payments)
    const isExpired = orderService.isExpired(order);

    // Return order with tickets if payment is successful
    return NextResponse.json<
      ApiResponse<{
        order: {
          id: number;
          uuid: string;
          paymentReferenceId: string;
          totalAmount: number;
          ticketsCount: number;
          paymentType: 'direct' | 'transfer';
          paymentStatus: 'pending' | 'success' | 'failed';
          expiresAt: Date | null;
          errorMessage: string | null;
          createdAt: Date;
          updatedAt: Date;
        };
        tickets?: Array<{ id: number; ticketNumber: string }>;
        isExpired?: boolean;
        campaign?: {
          accountNumber: string | null;
          bankNameOrCode: string | null;
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
          paymentType: order.paymentType,
          paymentStatus: order.paymentStatus,
          expiresAt: order.expiresAt,
          errorMessage: order.errorMessage,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        },
        tickets: order.tickets,
        ...(isExpired && order.paymentStatus === 'pending' ? { isExpired: true } : {}),
        ...(campaign && order.paymentType === 'transfer'
          ? {
              campaign: {
                accountNumber: campaign.accountNumber || null,
                bankNameOrCode: campaign.bankNameOrCode || null,
              },
            }
          : {}),
      },
    });
  } catch (error) {
    console.error('Error fetching order:', error);

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch order',
        },
      },
      { status: 500 }
    );
  }
}
