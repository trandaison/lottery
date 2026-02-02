import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  tickets,
  users,
  winningNumbers,
  campaignPrizes,
} from '@/db/schema';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { campaignService } from '@/services/campaign.service';
import type { ApiResponse } from '@/types';

type RouteParams = { params: Promise<{ id: string }> };

const SORT_BY = ['createdAt', 'status', 'ticketNumber', 'userName'] as const;
const SORT_ORDER = ['asc', 'desc'] as const;

/**
 * GET /api/v1/admin/campaigns/:id/tickets
 * List tickets for a campaign with user info and prize title for winning tickets.
 * Matching: ticket_number suffix (right-to-left) matches winning_numbers.number.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const campaignId = parseInt(id, 10);
    if (Number.isNaN(campaignId)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: { code: 'INVALID_ID', message: 'Campaign ID must be a valid number' },
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

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10) || 100));
    const search = searchParams.get('search')?.trim() ?? '';
    const sortBy = (SORT_BY.includes(searchParams.get('sortBy') as (typeof SORT_BY)[number])
      ? searchParams.get('sortBy')
      : 'createdAt') as (typeof SORT_BY)[number];
    const sortOrder = (SORT_ORDER.includes(searchParams.get('sortOrder') as (typeof SORT_ORDER)[number])
      ? searchParams.get('sortOrder')
      : 'desc') as (typeof SORT_ORDER)[number];

    const whereConditions = [eq(tickets.campaignId, campaignId)];
    if (search.length > 0) {
      whereConditions.push(sql`${tickets.ticketNumber} ILIKE ${'%' + search + '%'}`);
    }
    const whereClause =
      whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions);

    const orderByColumn =
      sortBy === 'status'
        ? tickets.isWinning
        : sortBy === 'ticketNumber'
          ? tickets.ticketNumber
          : sortBy === 'userName'
            ? users.name
            : tickets.createdAt;
    const orderBy = sortOrder === 'asc' ? asc(orderByColumn) : desc(orderByColumn);

    const offset = (page - 1) * limit;

    const rows = await db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        isWinning: tickets.isWinning,
        createdAt: tickets.createdAt,
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
      })
      .from(tickets)
      .innerJoin(users, eq(tickets.userId, users.id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(whereClause);
    const total = countResult?.count ?? 0;

    // Winning numbers for this campaign (number -> prize title)
    const wnRows = await db
      .select({
        number: winningNumbers.number,
        title: campaignPrizes.title,
      })
      .from(winningNumbers)
      .innerJoin(campaignPrizes, eq(winningNumbers.campaignPrizeId, campaignPrizes.id))
      .where(eq(campaignPrizes.campaignId, campaignId));
    const numberToPrizeTitle = Object.fromEntries(
      wnRows.map((r) => [r.number, r.title])
    );

    const ticketsList = rows.map((row) => {
      let prizeTitle: string | null = null;
      if (row.isWinning) {
        for (const wn of wnRows) {
          const len = wn.number.length;
          const suffix = row.ticketNumber.slice(-len);
          if (suffix === wn.number) {
            prizeTitle = wn.title;
            break;
          }
        }
      }
      return {
        id: row.id,
        ticketNumber: row.ticketNumber,
        user: { id: row.userId, name: row.userName, email: row.userEmail },
        prizeTitle,
        isWinning: row.isWinning,
        createdAt: row.createdAt,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        tickets: ticketsList,
        pagination: { total, page, limit, totalPages },
      },
    });
  } catch (error) {
    console.error('Error listing campaign tickets:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to list tickets' },
      },
      { status: 500 }
    );
  }
}
