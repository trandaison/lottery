import { NextRequest, NextResponse } from 'next/server';
import { campaignService } from '@/services/campaign.service';
import type { ApiResponse } from '@/types';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/admin/campaigns/[id]/complete
 * Chốt kết quả: chuyển campaign sang completed (chỉ khi status = drawing và đã quay đủ tất cả giải).
 * Hủy tất cả đơn hàng đang chờ thanh toán.
 */
export async function POST(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const campaignId = parseInt(id, 10);
    if (Number.isNaN(campaignId)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            message: 'Campaign ID must be a valid number',
          },
        },
        { status: 400 }
      );
    }

    const { campaign, failedOrdersCount } = await campaignService.complete(
      campaignId
    );

    return NextResponse.json<ApiResponse<{ campaign: typeof campaign; failedOrdersCount: number }>>({
      success: true,
      data: { campaign, failedOrdersCount },
    });
  } catch (error) {
    console.error('Error completing campaign:', error);

    if (error instanceof Error) {
      if (error.message === 'CAMPAIGN_NOT_FOUND') {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: {
              code: 'CAMPAIGN_NOT_FOUND',
              message: 'Campaign not found',
            },
          },
          { status: 404 }
        );
      }
      if (error.message.startsWith('CANNOT_COMPLETE:')) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: {
              code: 'CANNOT_COMPLETE',
              message: error.message.replace('CANNOT_COMPLETE: ', ''),
            },
          },
          { status: 400 }
        );
      }
      if (error.message.startsWith('INCOMPLETE_DRAW:')) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: {
              code: 'INCOMPLETE_DRAW',
              message: error.message.replace('INCOMPLETE_DRAW: ', ''),
            },
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to complete campaign',
        },
      },
      { status: 500 }
    );
  }
}
