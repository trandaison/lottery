import { NextRequest, NextResponse } from 'next/server';
import { campaignService } from '@/services/campaign.service';
import {
  updateCampaignSchema,
  type UpdateCampaignInput,
} from '@/lib/validations/campaign';
import type { ApiResponse, CampaignWithPrizes } from '@/types';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/admin/campaigns/[id]
 * Get a single campaign by ID (with prizes)
 */
export async function GET(
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

    const campaign = await campaignService.getById(campaignId);
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

    return NextResponse.json<ApiResponse<CampaignWithPrizes>>({
      success: true,
      data: campaign,
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

/**
 * PUT /api/v1/admin/campaigns/[id]
 * Update a campaign (and optionally prizes)
 */
export async function PUT(
  request: NextRequest,
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

    const body = await request.json();
    const validatedData = updateCampaignSchema.parse(body) as UpdateCampaignInput;

    const { prizes, startTime, endTime, ...rest } = validatedData;
    const campaignInput = {
      ...rest,
      ...(startTime != null && { startTime: new Date(startTime) }),
      ...(endTime != null && { endTime: new Date(endTime) }),
    };

    const campaign = await campaignService.update(
      campaignId,
      campaignInput,
      prizes
    );

    return NextResponse.json<ApiResponse<CampaignWithPrizes>>({
      success: true,
      data: campaign,
    });
  } catch (error) {
    console.error('Error updating campaign:', error);

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
      if (
        error.message.startsWith('INVALID_') ||
        error.message.startsWith('SLUG_EXISTS')
      ) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: {
              code: error.message.split(':')[0],
              message: error.message.split(':')[1]?.trim() || error.message,
            },
          },
          { status: 400 }
        );
      }
      if (error.name === 'ZodError') {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: error.message,
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
          message: 'Failed to update campaign',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/admin/campaigns/[id]
 * Delete a campaign (hard delete)
 */
export async function DELETE(
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

    const existing = await campaignService.getById(campaignId);
    if (!existing) {
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

    await campaignService.delete(campaignId);
    return NextResponse.json<ApiResponse>({ success: true });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete campaign',
        },
      },
      { status: 500 }
    );
  }
}
