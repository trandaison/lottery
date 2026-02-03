import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { campaignService } from '@/services/campaign.service';
import { userService } from '@/services/user.service';
import { ticketService } from '@/services/ticket.service';
import type { ApiResponse } from '@/types';

const emailSchema = z.string().email('Invalid email address');

type RouteContext = { params: Promise<{ slug: string }> };

/**
 * GET /api/v1/campaigns/[slug]/lookup?email=...
 * Look up user by email for a campaign: returns user info (if any) and tickets count for this campaign.
 * Used by purchase form to auto-fill and to apply minimum_tickets validation.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const { searchParams } = new URL(request.url);
    const emailParam = searchParams.get('email');

    if (!emailParam?.trim()) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'MISSING_EMAIL',
            message: 'Email is required',
          },
        },
        { status: 400 }
      );
    }

    const email = emailSchema.parse(emailParam.trim());

    const campaign = await campaignService.getBySlug(slug);
    if (!campaign) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'CAMPAIGN_NOT_FOUND',
            message: 'Campaign không tồn tại',
          },
        },
        { status: 404 }
      );
    }

    const user = await userService.getByEmail(email);
    if (!user) {
      return NextResponse.json<ApiResponse<{ user: null; ticketsCountForCampaign: number }>>({
        success: true,
        data: { user: null, ticketsCountForCampaign: 0 },
      });
    }

    const ticketsCountForCampaign = await ticketService.countByUserAndCampaign(user.id, campaign.id);

    return NextResponse.json<
      ApiResponse<{
        user: { name: string; email: string; phone: string };
        ticketsCountForCampaign: number;
      }>
    >({
      success: true,
      data: {
        user: {
          name: user.name,
          email: user.email,
          phone: user.phone ?? '',
        },
        ticketsCountForCampaign,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.issues.map((e) => e.message).join(', '),
          },
        },
        { status: 400 }
      );
    }
    console.error('Lookup error:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to lookup',
        },
      },
      { status: 500 }
    );
  }
}
