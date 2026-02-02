import { db } from '@/db';
import {
  tickets,
  winningNumbers,
  campaignPrizes,
  campaigns,
  users,
  type Ticket,
  type WinningNumber,
  type CampaignPrize,
} from '@/db/schema';
import { eq, and, sql, inArray, asc } from 'drizzle-orm';

/**
 * Draw Service
 *
 * Handles draw-related business logic including:
 * - Query-first winning number algorithm
 * - Finding matching tickets (RIGHT match)
 * - Saving winning numbers (WITHOUT left-padding)
 * - Marking tickets as winning
 * - Redo draw logic
 *
 * Architecture Principles:
 * - Uses BIGINT IDs for internal operations
 * - Query-first approach: Always returns existing ticket numbers
 * - Stores winning numbers WITHOUT left-padding (e.g., "321" not "000321")
 * - Matches tickets from RIGHT to LEFT
 * - Follows clean code and single responsibility principle
 */
export class DrawService {
  /**
   * Query winning number using query-first algorithm
   * Algorithm:
   * 1. Query distinct suffixes from sold tickets (last N digits)
   * 2. Match from RIGHT (last N digits)
   * 3. Exclude tickets where is_winning=true if excludeWinning
   * 4. Randomly select one suffix
   * 5. Return WITHOUT left-padding (e.g., "321" for matching_digits=3)
   *
   * @param campaignId - Campaign ID
   * @param matchingDigits - Number of digits to match (1-6)
   * @param excludeWinning - Whether to exclude already winning tickets
   * @returns Winning number suffix WITHOUT left-padding (e.g., "321", "45", "123456")
   */
  async queryWinningNumber(
    campaignId: number,
    matchingDigits: number,
    excludeWinning: boolean
  ): Promise<string> {
    if (matchingDigits < 1 || matchingDigits > 6) {
      throw new Error(
        `INVALID_MATCHING_DIGITS: Matching digits must be between 1 and 6, got ${matchingDigits}`
      );
    }

    // Build query to get distinct suffixes from sold tickets
    // Use PostgreSQL RIGHT() function to extract last N digits
    const whereConditions = excludeWinning
      ? and(eq(tickets.campaignId, campaignId), eq(tickets.isWinning, false))
      : eq(tickets.campaignId, campaignId);

    const suffixes = await db
      .selectDistinct({
        suffix: sql<string>`RIGHT(${tickets.ticketNumber}, ${matchingDigits})`,
      })
      .from(tickets)
      .where(whereConditions);

    if (suffixes.length === 0) {
      throw new Error(
        `NO_AVAILABLE_TICKETS: No tickets available for draw with matching_digits=${matchingDigits}`
      );
    }

    // Randomly select one suffix
    const randomIndex = Math.floor(Math.random() * suffixes.length);
    const winningSuffix = suffixes[randomIndex]!.suffix;

    // RIGHT() function preserves digits as-is, but trim any whitespace
    // and ensure it's a valid number string
    return winningSuffix.trim();
  }

  /**
   * Get all candidate numbers (distinct suffixes) for a prize draw.
   * Used when client shuffles and animates; no random pick on server.
   *
   * @param campaignId - Campaign ID
   * @param matchingDigits - Number of digits to match (1-6)
   * @param excludeWinning - Whether to exclude already winning tickets
   * @returns Array of suffix strings WITHOUT left-padding
   */
  async getCandidateNumbers(
    campaignId: number,
    matchingDigits: number,
    excludeWinning: boolean
  ): Promise<string[]> {
    if (matchingDigits < 1 || matchingDigits > 6) {
      throw new Error(
        `INVALID_MATCHING_DIGITS: Matching digits must be between 1 and 6, got ${matchingDigits}`
      );
    }

    const whereConditions = excludeWinning
      ? and(eq(tickets.campaignId, campaignId), eq(tickets.isWinning, false))
      : eq(tickets.campaignId, campaignId);

    const suffixes = await db
      .selectDistinct({
        suffix: sql<string>`RIGHT(${tickets.ticketNumber}, ${matchingDigits})`,
      })
      .from(tickets)
      .where(whereConditions);

    return suffixes.map((s) => s.suffix.trim()).filter(Boolean);
  }

  /**
   * Find matching tickets for a winning number
   * Matches from RIGHT to LEFT (last N digits)
   *
   * @param campaignId - Campaign ID
   * @param winningNumber - Winning number suffix (e.g., "321", "45", "123456")
   * @param matchingDigits - Number of digits to match
   * @returns Array of matching tickets
   */
  async findMatchingTickets(
    campaignId: number,
    winningNumber: string,
    matchingDigits: number
  ): Promise<Ticket[]> {
    // Query tickets where RIGHT(ticket_number, N) = winningNumber
    const matchingTickets = await db
      .select()
      .from(tickets)
      .where(
        and(
          eq(tickets.campaignId, campaignId),
          sql`RIGHT(${tickets.ticketNumber}, ${matchingDigits}) = ${winningNumber}`
        )
      );

    return matchingTickets;
  }

  /**
   * Save winning number to database
   * Stores WITHOUT left-padding (e.g., "321" not "000321")
   *
   * @param campaignPrizeId - Campaign prize ID
   * @param number - Winning number WITHOUT padding (e.g., "321", "45", "123456")
   * @returns Saved winning number
   */
  async saveWinningNumber(
    campaignPrizeId: number,
    number: string
  ): Promise<WinningNumber> {
    // Validate number length (1-6 digits)
    if (number.length < 1 || number.length > 6) {
      throw new Error(
        `INVALID_WINNING_NUMBER: Winning number must be 1-6 digits, got "${number}"`
      );
    }

    // Validate number contains only digits
    if (!/^\d+$/.test(number)) {
      throw new Error(
        `INVALID_WINNING_NUMBER: Winning number must contain only digits, got "${number}"`
      );
    }

    const [saved] = await db
      .insert(winningNumbers)
      .values({
        campaignPrizeId,
        number, // Store WITHOUT padding
      })
      .returning();

    if (!saved) {
      throw new Error('FAILED_TO_SAVE_WINNING_NUMBER: Could not save winning number');
    }

    return saved;
  }

  /**
   * Mark tickets as winning (is_winning = true)
   *
   * @param ticketIds - Array of ticket IDs to mark as winning
   */
  async markTicketsAsWinning(ticketIds: number[]): Promise<void> {
    if (ticketIds.length === 0) {
      return;
    }

    await db
      .update(tickets)
      .set({
        isWinning: true,
        updatedAt: new Date(),
      })
      .where(inArray(tickets.id, ticketIds));
  }

  /**
   * Unmark tickets (is_winning = false)
   * Used for redo draw functionality
   *
   * @param ticketIds - Array of ticket IDs to unmark
   */
  async unmarkTickets(ticketIds: number[]): Promise<void> {
    if (ticketIds.length === 0) {
      return;
    }

    await db
      .update(tickets)
      .set({
        isWinning: false,
        updatedAt: new Date(),
      })
      .where(inArray(tickets.id, ticketIds));
  }

  /**
   * Get prizes for a campaign with draw status
   * Orders by matching_digits ASC, created_at ASC
   *
   * @param campaignId - Campaign ID
   * @returns Array of prizes with winning numbers and draw status
   */
  async getPrizesWithDrawStatus(campaignId: number): Promise<
    Array<
      CampaignPrize & {
        winningNumbers: WinningNumber[];
        drawStatus: 'not_drawn' | 'drawn' | 'completed';
      }
    >
  > {
    // Get all prizes for the campaign, ordered by matching_digits ASC, created_at ASC
    const prizes = await db
      .select()
      .from(campaignPrizes)
      .where(eq(campaignPrizes.campaignId, campaignId))
      .orderBy(asc(campaignPrizes.matchingDigits), asc(campaignPrizes.createdAt));

    // Get all winning numbers for these prizes
    const prizeIds = prizes.map((p) => p.id);
    const allWinningNumbers =
      prizeIds.length > 0
        ? await db
            .select()
            .from(winningNumbers)
            .where(inArray(winningNumbers.campaignPrizeId, prizeIds))
        : [];

    // Group winning numbers by prize ID
    const winningNumbersByPrize = new Map<number, WinningNumber[]>();
    for (const wn of allWinningNumbers) {
      const existing = winningNumbersByPrize.get(wn.campaignPrizeId) || [];
      existing.push(wn);
      winningNumbersByPrize.set(wn.campaignPrizeId, existing);
    }

    // Combine prizes with their winning numbers and determine draw status
    return prizes.map((prize) => {
      const prizeWinningNumbers = winningNumbersByPrize.get(prize.id) || [];
      let drawStatus: 'not_drawn' | 'drawn' | 'completed';

      if (prizeWinningNumbers.length === 0) {
        drawStatus = 'not_drawn';
      } else if (prizeWinningNumbers.length >= prize.prizesCount) {
        drawStatus = 'completed';
      } else {
        drawStatus = 'drawn';
      }

      return {
        ...prize,
        winningNumbers: prizeWinningNumbers,
        drawStatus,
      };
    });
  }

  /**
   * Get winning number by ID
   *
   * @param winningNumberId - Winning number ID
   * @returns Winning number or null
   */
  async getWinningNumberById(winningNumberId: number): Promise<WinningNumber | null> {
    const [winningNumber] = await db
      .select()
      .from(winningNumbers)
      .where(eq(winningNumbers.id, winningNumberId))
      .limit(1);

    return winningNumber || null;
  }

  /**
   * Delete winning number and unmark associated tickets
   * Used for redo draw functionality
   *
   * @param winningNumberId - Winning number ID to delete
   */
  async redoDraw(winningNumberId: number): Promise<void> {
    // Get winning number
    const winningNumber = await this.getWinningNumberById(winningNumberId);

    if (!winningNumber) {
      throw new Error(`WINNING_NUMBER_NOT_FOUND: Winning number ${winningNumberId} not found`);
    }

    // Get prize to determine matching digits
    const [prize] = await db
      .select()
      .from(campaignPrizes)
      .where(eq(campaignPrizes.id, winningNumber.campaignPrizeId))
      .limit(1);

    if (!prize) {
      throw new Error(
        `PRIZE_NOT_FOUND: Prize ${winningNumber.campaignPrizeId} not found for winning number ${winningNumberId}`
      );
    }

    // Find matching tickets that were marked as winning
    const matchingTickets = await this.findMatchingTickets(
      prize.campaignId,
      winningNumber.number,
      prize.matchingDigits
    );

    // Unmark tickets
    const ticketIds = matchingTickets.map((t) => t.id);
    await this.unmarkTickets(ticketIds);

    // Delete winning number
    await db.delete(winningNumbers).where(eq(winningNumbers.id, winningNumberId));
  }

  /**
   * Get campaign with excludeWinningNumbers setting
   *
   * @param campaignId - Campaign ID
   * @returns Campaign or null
   */
  async getCampaign(campaignId: number) {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    return campaign || null;
  }
}

// Export singleton instance
export const drawService = new DrawService();
