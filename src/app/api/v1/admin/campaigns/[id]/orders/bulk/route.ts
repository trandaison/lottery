import { NextRequest, NextResponse } from 'next/server';
import { orderService } from '@/services/order.service';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { ApiResponse } from '@/types';

type RouteParams = { params: Promise<{ id: string }> };

const validStatuses = ['pending', 'success', 'failed'] as const;

/**
 * POST /api/v1/admin/campaigns/:id/orders/bulk
 * Body: { action: 'delete' | 'updateStatus', orderIds: number[], paymentStatus?: 'pending'|'success'|'failed' }
 * - action delete: bulk delete orders (must belong to this campaign).
 * - action updateStatus: bulk update paymentStatus; for pending->success runs manual ticket creation + email per order.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const campaignId = parseInt(id, 10);
    if (Number.isNaN(campaignId)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: { code: 'INVALID_ID', message: 'Campaign ID must be a valid number' },
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const action = body?.action as string | undefined;
    const orderIds = body?.orderIds as unknown;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'orderIds must be a non-empty array of numbers' },
        },
        { status: 400 }
      );
    }

    const ids = orderIds.map((x: unknown) => (typeof x === 'number' ? x : parseInt(String(x), 10))).filter((n: number) => !Number.isNaN(n));
    if (ids.length === 0) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'orderIds must contain valid numbers' },
        },
        { status: 400 }
      );
    }

    if (action === 'delete') {
      const deletedIds = await db
        .delete(orders)
        .where(and(eq(orders.campaignId, campaignId), inArray(orders.id, ids)))
        .returning({ id: orders.id });
      return NextResponse.json({
        success: true,
        data: { deleted: deletedIds.length },
      });
    }

    if (action === 'updateStatus') {
      const paymentStatus = body?.paymentStatus as string | undefined;
      if (
        !paymentStatus ||
        !(validStatuses as readonly string[]).includes(paymentStatus)
      ) {
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

      const ordersInCampaign = await db
        .select({ id: orders.id, paymentStatus: orders.paymentStatus })
        .from(orders)
        .where(and(eq(orders.campaignId, campaignId), inArray(orders.id, ids)));

      const toUpdate = ordersInCampaign.filter((o) => o.paymentStatus !== paymentStatus);
      let updated = 0;
      for (const o of toUpdate) {
        try {
          if (paymentStatus === 'success' && o.paymentStatus === 'pending') {
            await orderService.markAsSuccessManually(o.id);
          } else {
            await orderService.updatePaymentStatus(
              o.id,
              paymentStatus as 'pending' | 'success' | 'failed'
            );
          }
          updated += 1;
        } catch (err) {
          console.error(`Bulk update order ${o.id} failed:`, err);
        }
      }
      return NextResponse.json({
        success: true,
        data: { updated },
      });
    }

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'action must be delete or updateStatus' },
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in bulk orders action:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Bulk action failed' },
      },
      { status: 500 }
    );
  }
}
