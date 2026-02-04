import { NextRequest, NextResponse } from 'next/server';
import { campaignService } from '@/services/campaign.service';
import { orderService } from '@/services/order.service';
import type { ApiResponse } from '@/types';

type RouteContext = { params: Promise<{ slug: string }> };

const STATEMENT_LIMIT = 100;

function maskEmail(email: string): string {
  if (!email || typeof email !== 'string') return '*****';
  const at = email.indexOf('@');
  if (at === -1) return '*****';
  return email.slice(0, at) + '@*****';
}

/**
 * GET /api/v1/campaigns/[slug]/statement
 * Public endpoint: list orders for campaign (by slug) for "Sao kê" with masked email.
 * Sort: createdAt desc. No auth required.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;

    const campaign = await campaignService.getBySlug(slug);
    if (!campaign) {
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

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(
      STATEMENT_LIMIT,
      Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50)
    );

    const { orders: ordersList, total } = await orderService.listByCampaign(
      campaign.id,
      {
        sortBy: 'createdAt',
        sortOrder: 'desc',
        page,
        limit,
      }
    );

    const totalPages = Math.ceil(total / limit);

    const orders = ordersList.map((o) => ({
      paymentReferenceId: o.paymentReferenceId,
      paymentStatus: o.paymentStatus,
      emailMasked: maskEmail(o.user?.email ?? ''),
      ticketsCount: o.ticketsCount,
      totalAmount: o.totalAmount,
      createdAt: o.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        orders,
        pagination: { total, page, limit, totalPages },
      },
    });
  } catch (error) {
    console.error('Error fetching campaign statement:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch statement',
        },
      },
      { status: 500 }
    );
  }
}
