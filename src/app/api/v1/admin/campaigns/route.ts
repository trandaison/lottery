import { NextRequest, NextResponse } from 'next/server';
import { campaignService } from '@/services/campaign.service';
import {
  createCampaignSchema,
  campaignFiltersSchema,
  type CreateCampaignInput,
} from '@/lib/validations/campaign';
import type { ApiResponse, CampaignWithPrizes } from '@/types';

/**
 * GET /api/v1/admin/campaigns
 * List campaigns with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query parameters
    const filters = campaignFiltersSchema.parse({
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
    });

    const result = await campaignService.list(filters);

    return NextResponse.json<ApiResponse<typeof result>>({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error listing campaigns:', error);

    if (error instanceof Error) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'LIST_CAMPAIGNS_FAILED',
            message: error.message,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list campaigns',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/campaigns
 * Create a new campaign with prizes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = createCampaignSchema.parse(body) as CreateCampaignInput;

    // Extract prizes from the data
    const { prizes, ...campaignData } = validatedData;

    // Convert string dates to Date objects
    const campaignInput = {
      ...campaignData,
      startTime: new Date(campaignData.startTime),
      endTime: new Date(campaignData.endTime),
    };

    // Create campaign
    const campaign = await campaignService.create(campaignInput, prizes);

    return NextResponse.json<ApiResponse<CampaignWithPrizes>>(
      {
        success: true,
        data: campaign,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating campaign:', error);

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
    }

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create campaign',
        },
      },
      { status: 500 }
    );
  }
}
