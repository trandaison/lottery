import { NextRequest, NextResponse } from 'next/server';
import { orderService } from '@/services/order.service';
import type { ApiResponse } from '@/types';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/v1/admin/orders/:id
 * Update order payment status. When changing pending -> success, creates tickets and sends email (manual flow, no webhook fields).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (Number.isNaN(orderId)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: { code: 'INVALID_ID', message: 'Order ID must be a valid number' },
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const paymentStatus = body?.paymentStatus as string | undefined;
    const validStatuses = ['pending', 'success', 'failed'];
    if (!paymentStatus || !validStatuses.includes(paymentStatus)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'paymentStatus must be one of: pending, success, failed',
          },
        },
        { status: 400 }
      );
    }

    const order = await orderService.getById(orderId);
    if (!order) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
        },
        { status: 404 }
      );
    }

    if (order.paymentStatus === paymentStatus) {
      return NextResponse.json({
        success: true,
        data: { order: { ...order, paymentStatus } },
      });
    }

    if (paymentStatus === 'success' && order.paymentStatus === 'pending') {
      const updated = await orderService.markAsSuccessManually(orderId);
      return NextResponse.json({
        success: true,
        data: { order: updated },
      });
    }

    const errorMessage = body?.errorMessage as string | undefined;
    const updated = await orderService.updatePaymentStatus(
      orderId,
      paymentStatus as 'pending' | 'success' | 'failed',
      paymentStatus === 'failed' && errorMessage != null ? { errorMessage } : undefined
    );
    return NextResponse.json({
      success: true,
      data: { order: updated },
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    if (error instanceof Error) {
      if (error.message === 'ORDER_NOT_FOUND') {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
          },
          { status: 404 }
        );
      }
      if (error.message.startsWith('ORDER_NOT_PENDING')) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: {
              code: 'INVALID_STATUS',
              message: 'Chỉ đơn hàng đang pending mới có thể chuyển thành success thủ công',
            },
          },
          { status: 400 }
        );
      }
    }
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update order' },
      },
      { status: 500 }
    );
  }
}
