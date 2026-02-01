import { NextRequest, NextResponse } from 'next/server';
import { orderService } from '@/services/order.service';
import { campaignService } from '@/services/campaign.service';
import type { ApiResponse } from '@/types';

type RouteParams = { params: Promise<{ id: string }> };

const SORT_BY = ['createdAt', 'paymentStatus', 'userId', 'ticketsCount'] as const;
const SORT_ORDER = ['asc', 'desc'] as const;

/**
 * GET /api/v1/admin/campaigns/:id/orders
 * List orders for a campaign with optional status filter, pagination, sort.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const campaign = await campaignService.getById(campaignId);
    if (!campaign) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: { code: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found' },
        },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '30', 10) || 30));
    const status = searchParams.get('status') as 'pending' | 'success' | 'failed' | null;
    const sortBy = (SORT_BY.includes(searchParams.get('sortBy') as (typeof SORT_BY)[number])
      ? searchParams.get('sortBy')
      : 'createdAt') as (typeof SORT_BY)[number];
    const sortOrder = (SORT_ORDER.includes(searchParams.get('sortOrder') as (typeof SORT_ORDER)[number])
      ? searchParams.get('sortOrder')
      : 'desc') as (typeof SORT_ORDER)[number];

    const filters = {
      page,
      limit,
      sortBy,
      sortOrder,
      ...(status && { status }),
    };

    const { orders: ordersList, total } = await orderService.listByCampaign(campaignId, filters);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        orders: ordersList,
        pagination: { total, page, limit, totalPages },
      },
    });
  } catch (error) {
    console.error('Error listing campaign orders:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to list orders' },
      },
      { status: 500 }
    );
  }
}
