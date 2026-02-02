import { NextRequest, NextResponse } from 'next/server';
import { drawService } from '@/services/draw.service';
import { campaignService } from '@/services/campaign.service';
import type { ApiResponse } from '@/types';
import { campaignPrizes } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/admin/campaigns/[id]/draw/candidates?prizeId=123
 * Returns all candidate numbers (distinct suffixes) for a prize.
 * Client shuffles this list and animates through it; on stop, client sends chosen number to POST /draw.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: idParam } = await context.params;
    const campaignId = parseInt(idParam);
    const { searchParams } = new URL(request.url);
    const prizeIdParam = searchParams.get('prizeId');

    if (isNaN(campaignId)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: { code: 'INVALID_ID', message: 'Invalid campaign ID' },
        },
        { status: 400 }
      );
    }

    const prizeId = prizeIdParam ? parseInt(prizeIdParam) : NaN;
    if (isNaN(prizeId) || prizeId < 1) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: { code: 'INVALID_PRIZE_ID', message: 'Valid prizeId query is required' },
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

    const [prize] = await db
      .select()
      .from(campaignPrizes)
      .where(
        and(
          eq(campaignPrizes.id, prizeId),
          eq(campaignPrizes.campaignId, campaignId)
        )
      )
      .limit(1);

    if (!prize) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: { code: 'PRIZE_NOT_FOUND', message: 'Prize not found' },
        },
        { status: 404 }
      );
    }

    const numbers = await drawService.getCandidateNumbers(
      campaignId,
      prize.matchingDigits,
      campaign.excludeWinningNumbers
    );

    return NextResponse.json<ApiResponse<{ numbers: string[] }>>({
      success: true,
      data: { numbers },
    });
  } catch (error) {
    console.error('Error fetching draw candidates:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch candidates';
    const code = message.split(':')[0];
    const msg = message.split(':')[1]?.trim() || message;
    if (
      code === 'INVALID_MATCHING_DIGITS' ||
      code === 'NO_AVAILABLE_TICKETS' ||
      code === 'CAMPAIGN_NOT_FOUND' ||
      code === 'PRIZE_NOT_FOUND'
    ) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code, message: msg } },
        { status: 400 }
      );
    }
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch draw candidates' },
      },
      { status: 500 }
    );
  }
}
