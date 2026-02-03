import { NextRequest, NextResponse } from 'next/server';
import { drawService } from '@/services/draw.service';
import { campaignService } from '@/services/campaign.service';
import type { ApiResponse, PrizeWithDrawStatus } from '@/types';
import { tickets, users } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/db';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/admin/campaigns/[id]/prizes
 * Get prizes for a campaign with draw status and winners
 */
export async function GET(request: NextRequest, context: RouteContext) {
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

    // Get prizes with draw status and stats (for % prize value display)
    const [prizesWithStatus, stats] = await Promise.all([
      drawService.getPrizesWithDrawStatus(campaignId),
      campaignService.getStats(campaignId),
    ]);

    // For each winning number, find the winners (users with matching tickets)
    const prizesWithWinners: PrizeWithDrawStatus[] = await Promise.all(
      prizesWithStatus.map(async (prize) => {
        const winningNumbersWithWinners = await Promise.all(
          prize.winningNumbers.map(async (winningNumber) => {
            // Find matching tickets for this winning number
            const matchingTickets = await db
              .select({
                ticket: tickets,
                user: users,
              })
              .from(tickets)
              .innerJoin(users, eq(tickets.userId, users.id))
              .where(
                and(
                  eq(tickets.campaignId, campaignId),
                  sql`RIGHT(${tickets.ticketNumber}, ${prize.matchingDigits}) = ${winningNumber.number}`
                )
              );

            // Group tickets by user
            const winnersMap = new Map<
              number,
              {
                userId: number;
                userUuid: string;
                name: string;
                email: string;
                phone: string | null;
                ticketNumbers: string[];
              }
            >();

            for (const { ticket, user } of matchingTickets) {
              const existing = winnersMap.get(user.id);
              if (existing) {
                existing.ticketNumbers.push(ticket.ticketNumber);
              } else {
                winnersMap.set(user.id, {
                  userId: user.id,
                  userUuid: user.uuid,
                  name: user.name,
                  email: user.email,
                  phone: user.phone,
                  ticketNumbers: [ticket.ticketNumber],
                });
              }
            }

            return {
              id: winningNumber.id,
              uuid: winningNumber.uuid,
              campaignPrizeId: winningNumber.campaignPrizeId,
              number: winningNumber.number,
              createdAt: winningNumber.createdAt,
              updatedAt: winningNumber.updatedAt,
              winners: Array.from(winnersMap.values()),
            };
          })
        );

        return {
          id: prize.id,
          uuid: prize.uuid,
          campaignId: prize.campaignId,
          title: prize.title,
          prizesCount: prize.prizesCount,
          matchingDigits: prize.matchingDigits,
          prizeValue: prize.prizeValue,
          prizeValuePercent: prize.prizeValuePercent ?? null,
          createdAt: prize.createdAt,
          updatedAt: prize.updatedAt,
          drawStatus: prize.drawStatus,
          winningNumbers: winningNumbersWithWinners,
        };
      })
    );

    return NextResponse.json<
      ApiResponse<{
        campaign: {
          id: number;
          uuid: string;
          title: string;
          excludeWinningNumbers: boolean;
          status: 'active' | 'drawing' | 'completed' | 'canceled';
          prizeValueType: 'fixed' | 'percent';
        };
        prizes: PrizeWithDrawStatus[];
        totalRevenue: number;
      }>
    >({
      success: true,
      data: {
        campaign: {
          id: campaign.id,
          uuid: campaign.uuid,
          title: campaign.title,
          excludeWinningNumbers: campaign.excludeWinningNumbers,
          status: campaign.status,
          prizeValueType: ((campaign as { prizeValueType?: string }).prizeValueType ?? 'fixed') as 'fixed' | 'percent',
        },
        prizes: prizesWithWinners,
        totalRevenue: stats.totalRevenue,
      },
    });
  } catch (error) {
    console.error('Error fetching prizes:', error);

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch prizes',
        },
      },
      { status: 500 }
    );
  }
}
