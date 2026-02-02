import { NextRequest, NextResponse } from 'next/server';
import { drawService } from '@/services/draw.service';
import { campaignService } from '@/services/campaign.service';
import type { ApiResponse } from '@/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/admin/campaigns/[id]/draw/check-winning?number=123456
 * Check if a ticket number (6-digit) has already won any prize in this campaign.
 * Used when excludeWinningNumbers is true: after wheels stop, check before saving.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: idParam } = await context.params;
    const campaignId = parseInt(idParam);
    const { searchParams } = new URL(request.url);
    const numberParam = searchParams.get('number');

    if (isNaN(campaignId)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid campaign ID' } },
        { status: 400 }
      );
    }

    if (numberParam == null || numberParam === '') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: 'MISSING_NUMBER', message: 'Query "number" is required' } },
        { status: 400 }
      );
    }

    const normalized = numberParam.padStart(6, '0').slice(-6);
    if (!/^\d{6}$/.test(normalized)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: 'INVALID_NUMBER', message: 'Number must be 1-6 digits' } },
        { status: 400 }
      );
    }

    const campaign = await campaignService.getById(campaignId);
    if (!campaign) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found' } },
        { status: 404 }
      );
    }

    const result = await drawService.checkTicketAlreadyWon(campaignId, normalized);

    return NextResponse.json<
      ApiResponse<{ alreadyWon: boolean; prize?: { id: number; title: string } }>
    >({
      success: true,
      data: result.alreadyWon
        ? { alreadyWon: true, prize: result.prize }
        : { alreadyWon: false },
    });
  } catch (error) {
    console.error('Error checking winning:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to check winning' },
      },
      { status: 500 }
    );
  }
}
