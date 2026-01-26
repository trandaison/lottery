import { NextRequest, NextResponse } from 'next/server';
import { campaignService } from '@/services/campaign.service';
import type { ApiResponse, CampaignWithPrizes, CampaignStatistics } from '@/types';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/v1/campaigns/[slug]
 * Public endpoint to get campaign by slug with statistics
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

    // Get campaign statistics
    const stats = await campaignService.getStats(campaign.id);

    return NextResponse.json<
      ApiResponse<CampaignWithPrizes & { stats: CampaignStatistics }>
    >({
      success: true,
      data: {
        ...campaign,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching campaign:', error);

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch campaign',
        },
      },
      { status: 500 }
    );
  }
}
