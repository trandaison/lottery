import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateWebhookJWT } from '@/services/payment.server';
import type { ApiResponse } from '@/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/admin/campaigns/[id]/webhook-jwt
 * Get current webhook JWT token for a campaign
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

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

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

    // Return existing webhook API key or generate new one if missing
    let webhookApiKey = campaign.webhookApiKey;

    if (!webhookApiKey && campaign.paymentType === 'transfer' && campaign.uuid) {
      // Generate new JWT if missing
      webhookApiKey = generateWebhookJWT(campaign.uuid);

      // Save to database
      await db
        .update(campaigns)
        .set({ webhookApiKey })
        .where(eq(campaigns.id, campaignId));
    }

    return NextResponse.json<ApiResponse<{ token: string | null }>>({
      success: true,
      data: { token: webhookApiKey },
    });
  } catch (error) {
    console.error('Error fetching webhook JWT:', error);

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch webhook JWT',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/campaigns/[id]/webhook-jwt
 * Reissue (regenerate) webhook JWT token for a campaign
 */
export async function POST(request: NextRequest, context: RouteContext) {
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

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

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

    if (campaign.paymentType !== 'transfer') {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_PAYMENT_TYPE',
            message: 'Webhook JWT is only available for transfer payment type',
          },
        },
        { status: 400 }
      );
    }

    if (!campaign.uuid) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'MISSING_UUID',
            message: 'Campaign UUID is missing',
          },
        },
        { status: 400 }
      );
    }

    // Generate new JWT
    const newWebhookApiKey = generateWebhookJWT(campaign.uuid);

    // Update in database
    await db
      .update(campaigns)
      .set({ webhookApiKey: newWebhookApiKey })
      .where(eq(campaigns.id, campaignId));

    return NextResponse.json<ApiResponse<{ token: string }>>({
      success: true,
      data: { token: newWebhookApiKey },
    });
  } catch (error) {
    console.error('Error reissuing webhook JWT:', error);

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to reissue webhook JWT',
        },
      },
      { status: 500 }
    );
  }
}
