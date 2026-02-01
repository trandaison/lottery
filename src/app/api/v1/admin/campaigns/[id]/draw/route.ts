import { NextRequest, NextResponse } from 'next/server';
import { drawService } from '@/services/draw.service';
import { campaignService } from '@/services/campaign.service';
import { drawRequestSchema, type DrawRequestInput } from '@/lib/validations/draw';
import type { ApiResponse, DrawResponse } from '@/types';
import { campaignPrizes, tickets, users } from '@/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '@/db';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/admin/campaigns/[id]/draw
 * Draw a winning number for a prize (query-first approach)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: idParam } = await context.params;
    const campaignId = parseInt(idParam);

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

    // Verify campaign exists
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

    // Parse and validate request body
    const body = await request.json();
    const validatedData = drawRequestSchema.parse(body) as DrawRequestInput;

    // Get prize
    const [prize] = await db
      .select()
      .from(campaignPrizes)
      .where(
        and(
          eq(campaignPrizes.id, validatedData.prizeId),
          eq(campaignPrizes.campaignId, campaignId)
        )
      )
      .limit(1);

    if (!prize) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'PRIZE_NOT_FOUND',
            message: 'Prize not found',
          },
        },
        { status: 404 }
      );
    }

    // Query winning number using query-first algorithm
    const winningNumber = await drawService.queryWinningNumber(
      campaignId,
      prize.matchingDigits,
      campaign.excludeWinningNumbers
    );

    // Find matching tickets
    const matchingTickets = await drawService.findMatchingTickets(
      campaignId,
      winningNumber,
      prize.matchingDigits
    );

    // Get users for matching tickets
    const userIds = Array.from(new Set(matchingTickets.map((t) => t.userId)));
    const matchingUsers =
      userIds.length > 0
        ? await db
            .select()
            .from(users)
            .where(inArray(users.id, userIds))
        : [];

    const usersMap = new Map(matchingUsers.map((u) => [u.id, u]));

    // Group tickets by user
    const winnersMap = new Map<
      number,
      {
        userId: number;
        userUuid: string;
        name: string;
        email: string;
        phone: string | null;
        tickets: Array<{
          id: number;
          uuid: string;
          ticketNumber: string;
          isWinning?: boolean;
        }>;
      }
    >();

    for (const ticket of matchingTickets) {
      const user = usersMap.get(ticket.userId);
      if (!user) continue;

      const existing = winnersMap.get(user.id);
      if (existing) {
        existing.tickets.push({
          id: ticket.id,
          uuid: ticket.uuid,
          ticketNumber: ticket.ticketNumber,
          isWinning: ticket.isWinning,
        });
      } else {
        winnersMap.set(user.id, {
          userId: user.id,
          userUuid: user.uuid,
          name: user.name,
          email: user.email,
          phone: user.phone,
          tickets: [
            {
              id: ticket.id,
              uuid: ticket.uuid,
              ticketNumber: ticket.ticketNumber,
              isWinning: ticket.isWinning,
            },
          ],
        });
      }
    }

    const winners = Array.from(winnersMap.values());

    // If draftMode = false, save winning number and mark tickets
    let savedWinningNumber;
    if (!validatedData.draftMode) {
      // Save winning number
      savedWinningNumber = await drawService.saveWinningNumber(prize.id, winningNumber);

      // Mark tickets as winning
      const ticketIds = matchingTickets.map((t) => t.id);
      await drawService.markTicketsAsWinning(ticketIds);

      // Update ticket isWinning status in response
      for (const winner of winners) {
        for (const ticket of winner.tickets) {
          ticket.isWinning = true;
        }
      }
    }

    const response: DrawResponse = {
      draftMode: validatedData.draftMode,
      winningNumber,
      matchingDigits: prize.matchingDigits,
      ...(savedWinningNumber && { savedWinningNumber }),
      winners,
    };

    return NextResponse.json<ApiResponse<DrawResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error drawing winning number:', error);

    // Handle validation errors
    if (error instanceof Error) {
      // Zod validation errors
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

      // Business logic errors
      const errorCode = error.message.split(':')[0];
      const errorMessage = error.message.split(':')[1]?.trim() || error.message;

      if (
        errorCode === 'INVALID_MATCHING_DIGITS' ||
        errorCode === 'NO_AVAILABLE_TICKETS' ||
        errorCode === 'INVALID_WINNING_NUMBER' ||
        errorCode === 'FAILED_TO_SAVE_WINNING_NUMBER' ||
        errorCode === 'PRIZE_NOT_FOUND' ||
        errorCode === 'CAMPAIGN_NOT_FOUND'
      ) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: {
              code: errorCode,
              message: errorMessage,
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
          message: 'Failed to draw winning number',
        },
      },
      { status: 500 }
    );
  }
}
