import { NextRequest, NextResponse } from 'next/server';
import { campaignService } from '@/services/campaign.service';
import { updateCampaignSchema, type UpdateCampaignInput } from '@/lib/validations/campaign';
import type { ApiResponse, CampaignWithPrizes } from '@/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/admin/campaigns/[id]
 * Get campaign by ID with prizes
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const campaignId = parseInt(id);

    if (isNaN(campaignId)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            message: 'Invalid campaign ID',
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
 * Update campaign (includes cancel and complete actions)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const campaignId = parseInt(id);

    if (isNaN(campaignId)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            message: 'Invalid campaign ID',
          },
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = updateCampaignSchema.parse(body) as UpdateCampaignInput;

    // Extract prizes if provided
    const { prizes, ...campaignData } = validatedData;

    // Convert string dates to Date objects if provided
    const campaignInput: any = { ...campaignData };
    if (campaignData.startTime) {
      campaignInput.startTime = new Date(campaignData.startTime);
    }
    if (campaignData.endTime) {
      campaignInput.endTime = new Date(campaignData.endTime);
    }

    // Handle cancel action
    if (campaignInput.status === 'canceled') {
      const campaign = await campaignService.cancel(campaignId);
      return NextResponse.json<ApiResponse<CampaignWithPrizes>>({
        success: true,
        data: await campaignService.getById(campaign.id) as CampaignWithPrizes,
      });
    }

    // Handle complete action
    if (campaignInput.status === 'completed') {
      const result = await campaignService.complete(campaignId);
      return NextResponse.json<ApiResponse<typeof result>>({
        success: true,
        data: {
          campaign: await campaignService.getById(result.campaign.id) as CampaignWithPrizes,
          failedOrdersCount: result.failedOrdersCount,
        },
      });
    }

    // Regular update
    const campaign = await campaignService.update(campaignId, campaignInput, prizes);

    return NextResponse.json<ApiResponse<CampaignWithPrizes>>({
      success: true,
      data: campaign,
    });
  } catch (error) {
    console.error('Error updating campaign:', error);

    if (error instanceof Error) {
      // Handle validation errors
      if (error.message.includes('Zod')) {
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

      // Handle business logic errors
      if (
        error.message.startsWith('INVALID_') ||
        error.message.startsWith('CANNOT_') ||
        error.message.startsWith('CAMPAIGN_NOT_FOUND') ||
        error.message.startsWith('SLUG_EXISTS') ||
        error.message.startsWith('INCOMPLETE_DRAW')
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
 * Delete campaign (hard delete)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const campaignId = parseInt(id);

    if (isNaN(campaignId)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            message: 'Invalid campaign ID',
          },
        },
        { status: 400 }
      );
    }

    await campaignService.delete(campaignId);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { message: 'Campaign deleted successfully' },
    });
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
