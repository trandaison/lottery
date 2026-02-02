import { db } from '@/db';
import {
  campaigns,
  campaignPrizes,
  type Campaign,
  type NewCampaign,
  type CampaignPrize,
  type NewCampaignPrize,
} from '@/db/schema';
import { eq, desc, asc, and, sql, count, countDistinct, inArray } from 'drizzle-orm';
import type { CampaignWithPrizes, CampaignStatistics } from '@/types';
import { tickets, orders, winningNumbers } from '@/db/schema';
import { generateWebhookJWT } from './payment.server';

/**
 * Campaign Service
 *
 * Handles all campaign-related business logic including:
 * - CRUD operations
 * - Slug generation
 * - Status transitions and validation
 * - Statistics calculation
 *
 * Architecture Principles:
 * - Uses BIGINT IDs for internal operations
 * - Generates UUIDs automatically via database
 * - Implements proper status transition validation
 * - Follows clean code and single responsibility principle
 */
export class CampaignService {
  /**
   * Generate URL-friendly slug from title
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD') // Normalize Vietnamese characters
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Create a new campaign with prizes
   */
  async create(
    data: Omit<NewCampaign, 'uuid' | 'createdAt' | 'updatedAt' | 'slug'> & { slug?: string },
    prizes: Omit<NewCampaignPrize, 'uuid' | 'campaignId' | 'createdAt' | 'updatedAt'>[]
  ): Promise<CampaignWithPrizes> {
    // Generate slug if not provided
    const slug = data.slug || this.generateSlug(data.title);

    // Validate dates
    if (data.startTime >= data.endTime) {
      throw new Error('INVALID_DATES: End time must be after start time');
    }

    // Validate at least one prize
    if (!prizes || prizes.length === 0) {
      throw new Error('INVALID_PRIZES: At least one prize is required');
    }

    // Validate matching_digits (1-6)
    for (const prize of prizes) {
      if (prize.matchingDigits < 1 || prize.matchingDigits > 6) {
        throw new Error('INVALID_MATCHING_DIGITS: Matching digits must be between 1 and 6');
      }
    }

    // Check slug uniqueness
    const existingCampaign = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.slug, slug))
      .limit(1);

    if (existingCampaign.length > 0) {
      throw new Error('SLUG_EXISTS: A campaign with this slug already exists');
    }

    // Create campaign and prizes in transaction
    return await db.transaction(async (tx) => {
      // Generate webhook JWT if payment type is transfer
      let webhookApiKey: string | null = null;
      if (data.paymentType === 'transfer') {
        // We'll generate JWT after campaign is created (need UUID)
        // For now, set to null, will update after creation
      }

      // Insert campaign
      const [campaign] = await tx
        .insert(campaigns)
        .values({ ...data, slug, webhookApiKey: null })
        .returning();

      // Generate webhook JWT if payment type is transfer
      if (data.paymentType === 'transfer' && campaign.uuid) {
        webhookApiKey = generateWebhookJWT(campaign.uuid);

        // Update campaign with webhook API key
        const [updated] = await tx
          .update(campaigns)
          .set({ webhookApiKey })
          .where(eq(campaigns.id, campaign.id))
          .returning();

        campaign.webhookApiKey = updated.webhookApiKey;
      }

      // Insert prizes
      const createdPrizes = await tx
        .insert(campaignPrizes)
        .values(
          prizes.map((prize) => ({
            ...prize,
            campaignId: campaign.id,
          }))
        )
        .returning();

      return {
        ...campaign,
        prizes: createdPrizes,
      };
    });
  }

  /**
   * Update an existing campaign
   */
  async update(
    id: number,
    data: Partial<Omit<NewCampaign, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>>,
    prizes?: Omit<NewCampaignPrize, 'uuid' | 'campaignId' | 'createdAt' | 'updatedAt'>[]
  ): Promise<CampaignWithPrizes> {
    // Get existing campaign
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('CAMPAIGN_NOT_FOUND');
    }

    // Validate status transitions if status is being changed
    if (data.status && data.status !== existing.status) {
      this.validateStatusTransition(existing.status, data.status);
    }

    // Validate dates if provided
    const startTime = data.startTime || existing.startTime;
    const endTime = data.endTime || existing.endTime;
    if (startTime >= endTime) {
      throw new Error('INVALID_DATES: End time must be after start time');
    }

    // If slug is being changed, check uniqueness
    if (data.slug && data.slug !== existing.slug) {
      const existingWithSlug = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.slug, data.slug))
        .limit(1);

      if (existingWithSlug.length > 0) {
        throw new Error('SLUG_EXISTS: A campaign with this slug already exists');
      }
    }

    return await db.transaction(async (tx) => {
      // Update campaign
      const [updated] = await tx
        .update(campaigns)
        .set({
          ...data,
          canceledAt: data.status === 'canceled' ? new Date() : existing.canceledAt,
        })
        .where(eq(campaigns.id, id))
        .returning();

      // Update prizes if provided
      let updatedPrizes: CampaignPrize[];
      if (prizes) {
        // Delete existing prizes
        await tx.delete(campaignPrizes).where(eq(campaignPrizes.campaignId, id));

        // Insert new prizes
        updatedPrizes = await tx
          .insert(campaignPrizes)
          .values(
            prizes.map((prize) => ({
              ...prize,
              campaignId: id,
            }))
          )
          .returning();
      } else {
        // Keep existing prizes
        updatedPrizes = await tx
          .select()
          .from(campaignPrizes)
          .where(eq(campaignPrizes.campaignId, id))
          .orderBy(asc(campaignPrizes.matchingDigits), asc(campaignPrizes.createdAt));
      }

      return {
        ...updated,
        prizes: updatedPrizes,
      };
    });
  }

  /**
   * Validate status transition
   */
  private validateStatusTransition(
    currentStatus: Campaign['status'],
    newStatus: Campaign['status']
  ): void {
    const validTransitions: Record<string, string[]> = {
      active: ['drawing', 'canceled', 'completed'],
      drawing: ['completed'],
      completed: [], // Cannot transition from completed
      canceled: [], // Cannot transition from canceled
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(
        `INVALID_STATUS_TRANSITION: Cannot transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  /**
   * Cancel a campaign (only if status is 'active')
   */
  async cancel(id: number): Promise<Campaign> {
    const campaign = await this.getById(id);
    if (!campaign) {
      throw new Error('CAMPAIGN_NOT_FOUND');
    }

    if (campaign.status !== 'active') {
      throw new Error('CANNOT_CANCEL: Only active campaigns can be canceled');
    }

    const [updated] = await db
      .update(campaigns)
      .set({
        status: 'canceled',
        canceledAt: new Date(),
      })
      .where(eq(campaigns.id, id))
      .returning();

    return updated;
  }

  /**
   * Complete a campaign (allowed from 'active' or 'drawing').
   * Also fails all pending orders.
   */
  async complete(id: number): Promise<{ campaign: Campaign; failedOrdersCount: number }> {
    const campaign = await this.getById(id);
    if (!campaign) {
      throw new Error('CAMPAIGN_NOT_FOUND');
    }

    if (campaign.status !== 'active' && campaign.status !== 'drawing') {
      throw new Error('CANNOT_COMPLETE: Only active or drawing campaigns can be completed');
    }

    // Check if all prizes have winning numbers
    // Each prize must have at least prizesCount winning numbers
    for (const prize of campaign.prizes) {
      const winningNumbersCount = await db
        .select({ count: count() })
        .from(winningNumbers)
        .where(eq(winningNumbers.campaignPrizeId, prize.id));

      const countValue = winningNumbersCount[0]?.count || 0;
      if (countValue < prize.prizesCount) {
        throw new Error(
          `INCOMPLETE_DRAW: Prize "${prize.title}" requires ${prize.prizesCount} winning number(s), but only ${countValue} found`
        );
      }
    }

    return await db.transaction(async (tx) => {
      // Update campaign status
      const [updated] = await tx
        .update(campaigns)
        .set({
          status: 'completed',
        })
        .where(eq(campaigns.id, id))
        .returning();

      // Fail all pending orders for this campaign
      const failedOrders = await tx
        .update(orders)
        .set({
          paymentStatus: 'failed',
          errorMessage: 'Campaign đã hoàn thành',
        })
        .where(
          and(
            eq(orders.campaignId, id),
            eq(orders.paymentStatus, 'pending')
          )
        )
        .returning();

      return {
        campaign: updated,
        failedOrdersCount: failedOrders.length,
      };
    });
  }

  /**
   * Delete a campaign (soft delete via status or hard delete)
   */
  async delete(id: number): Promise<void> {
    await db.delete(campaigns).where(eq(campaigns.id, id));
  }

  /**
   * Get campaign by ID with prizes
   */
  async getById(id: number): Promise<CampaignWithPrizes | null> {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);

    if (!campaign) {
      return null;
    }

    const prizes = await db
      .select()
      .from(campaignPrizes)
      .where(eq(campaignPrizes.campaignId, id))
      .orderBy(asc(campaignPrizes.matchingDigits), asc(campaignPrizes.createdAt));

    return {
      ...campaign,
      prizes,
    };
  }

  /**
   * Get campaign by slug with prizes (public endpoint)
   */
  async getBySlug(slug: string): Promise<CampaignWithPrizes | null> {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.slug, slug))
      .limit(1);

    if (!campaign) {
      return null;
    }

    const prizes = await db
      .select()
      .from(campaignPrizes)
      .where(eq(campaignPrizes.campaignId, campaign.id))
      .orderBy(asc(campaignPrizes.matchingDigits), asc(campaignPrizes.createdAt));

    return {
      ...campaign,
      prizes,
    };
  }

  /**
   * List campaigns with filters
   */
  async list(filters?: {
    status?: Campaign['status'];
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ campaigns: CampaignWithPrizes[]; total: number }> {
    const conditions = [];

    if (filters?.status) {
      conditions.push(eq(campaigns.status, filters.status));
    }

    if (filters?.search) {
      conditions.push(sql`${campaigns.title} ILIKE ${'%' + filters.search + '%'}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count: total }] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(whereClause);

    // Get campaigns
    const campaignsList = await db
      .select()
      .from(campaigns)
      .where(whereClause)
      .orderBy(desc(campaigns.createdAt))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);

    const campaignIds = campaignsList.map((c) => c.id);

    // Ticket counts per campaign
    const ticketCountRows =
      campaignIds.length > 0
        ? await db
            .select({
              campaignId: tickets.campaignId,
              ticketsSold: count(),
            })
            .from(tickets)
            .where(inArray(tickets.campaignId, campaignIds))
            .groupBy(tickets.campaignId)
        : [];
    const ticketsByCampaign = Object.fromEntries(
      ticketCountRows.map((r) => [r.campaignId, Number(r.ticketsSold)])
    );

    // Order counts per campaign
    const orderCountRows =
      campaignIds.length > 0
        ? await db
            .select({
              campaignId: orders.campaignId,
              ordersCount: count(),
            })
            .from(orders)
            .where(inArray(orders.campaignId, campaignIds))
            .groupBy(orders.campaignId)
        : [];
    const ordersByCampaign = Object.fromEntries(
      orderCountRows.map((r) => [r.campaignId, Number(r.ordersCount)])
    );

    // Get prizes for each campaign and merge counts
    const campaignsWithPrizes = await Promise.all(
      campaignsList.map(async (campaign) => {
        const prizes = await db
          .select()
          .from(campaignPrizes)
          .where(eq(campaignPrizes.campaignId, campaign.id))
          .orderBy(asc(campaignPrizes.matchingDigits), asc(campaignPrizes.createdAt));

        return {
          ...campaign,
          prizes,
          ticketsSold: ticketsByCampaign[campaign.id] ?? 0,
          ordersCount: ordersByCampaign[campaign.id] ?? 0,
        };
      })
    );

    return {
      campaigns: campaignsWithPrizes,
      total,
    };
  }

  /**
   * Get campaign statistics
   */
  async getStats(campaignId: number): Promise<CampaignStatistics> {
    // Count tickets sold
    const [{ ticketsSold }] = await db
      .select({ ticketsSold: count() })
      .from(tickets)
      .where(eq(tickets.campaignId, campaignId));

    // Count unique participants
    const [{ participantsCount }] = await db
      .select({ participantsCount: countDistinct(tickets.userId) })
      .from(tickets)
      .where(eq(tickets.campaignId, campaignId));

    // Calculate total revenue (sum of successful orders)
    const [{ totalRevenue }] = await db
      .select({ totalRevenue: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)` })
      .from(orders)
      .where(
        and(
          eq(orders.campaignId, campaignId),
          eq(orders.paymentStatus, 'success')
        )
      );

    return {
      ticketsSold,
      participantsCount,
      totalRevenue: Number(totalRevenue) || 0,
    };
  }

  /**
   * Update campaign status (for draw system)
   */
  async updateStatus(id: number, status: Campaign['status']): Promise<Campaign> {
    const campaign = await this.getById(id);
    if (!campaign) {
      throw new Error('CAMPAIGN_NOT_FOUND');
    }

    this.validateStatusTransition(campaign.status, status);

    const [updated] = await db
      .update(campaigns)
      .set({ status })
      .where(eq(campaigns.id, id))
      .returning();

    return updated;
  }
}

// Export singleton instance
export const campaignService = new CampaignService();
