import { db } from '@/db';
import { tickets, orderTickets, type Ticket, type NewTicket } from '@/db/schema';
import { eq, and, sql, inArray, count } from 'drizzle-orm';

/**
 * Ticket Service
 *
 * Handles ticket-related business logic including:
 * - Unique 6-digit ticket number generation
 * - Ticket creation (batch insert)
 * - Number availability checking
 *
 * Architecture Principles:
 * - Uses BIGINT IDs for internal operations
 * - Generates UUIDs automatically via database
 * - Ensures uniqueness within campaign scope
 * - Follows clean code and single responsibility principle
 */
export class TicketService {
  /**
   * Generate a single unique 6-digit ticket number for a campaign
   * Algorithm: Random generation + check uniqueness in DB
   *
   * @param campaignId - Campaign ID
   * @param maxAttempts - Maximum attempts to generate unique number (default: 100)
   * @returns 6-digit ticket number string (e.g., "123456")
   */
  private async generateUniqueTicketNumber(
    campaignId: number,
    maxAttempts: number = 100
  ): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Generate random 6-digit number (000000 to 999999)
      const number = Math.floor(Math.random() * 1000000);
      const ticketNumber = number.toString().padStart(6, '0');

      // Check if number already exists for this campaign
      const [existing] = await db
        .select()
        .from(tickets)
        .where(
          and(
            eq(tickets.campaignId, campaignId),
            eq(tickets.ticketNumber, ticketNumber)
          )
        )
        .limit(1);

      if (!existing) {
        return ticketNumber;
      }
    }

    throw new Error(
      `TICKET_GENERATION_FAILED: Could not generate unique ticket number after ${maxAttempts} attempts`
    );
  }

  /**
   * Generate multiple unique 6-digit ticket numbers for a campaign
   * Uses sequential generation to ensure uniqueness
   *
   * @param campaignId - Campaign ID
   * @param count - Number of tickets to generate
   * @returns Array of unique 6-digit ticket numbers
   */
  async generateUniqueTicketNumbers(
    campaignId: number,
    count: number
  ): Promise<string[]> {
    if (count <= 0) {
      throw new Error('INVALID_COUNT: Count must be greater than 0');
    }

    if (count > 1000) {
      throw new Error('INVALID_COUNT: Cannot generate more than 1000 tickets at once');
    }

    const ticketNumbers: string[] = [];

    // Generate tickets sequentially to ensure uniqueness
    for (let i = 0; i < count; i++) {
      const ticketNumber = await this.generateUniqueTicketNumber(campaignId);
      ticketNumbers.push(ticketNumber);
    }

    return ticketNumbers;
  }

  /**
   * Create tickets in batch
   * All tickets must be for the same campaign and user
   *
   * @param ticketData - Array of ticket data (campaignId, userId, ticketNumber)
   * @returns Array of created tickets
   */
  async createTickets(
    ticketData: Array<{
      campaignId: number;
      userId: number;
      ticketNumber: string;
    }>
  ): Promise<Ticket[]> {
    if (ticketData.length === 0) {
      return [];
    }

    // Validate all tickets are for same campaign and user
    const campaignId = ticketData[0].campaignId;
    const userId = ticketData[0].userId;

    for (const data of ticketData) {
      if (data.campaignId !== campaignId || data.userId !== userId) {
        throw new Error(
          'INVALID_TICKET_DATA: All tickets must be for the same campaign and user'
        );
      }

      // Validate ticket number format
      if (!/^\d{6}$/.test(data.ticketNumber)) {
        throw new Error(
          `INVALID_TICKET_NUMBER: Ticket number must be 6 digits, got ${data.ticketNumber}`
        );
      }
    }

    // Batch insert tickets
    const createdTickets = await db
      .insert(tickets)
      .values(
        ticketData.map((data) => ({
          campaignId: data.campaignId,
          userId: data.userId,
          ticketNumber: data.ticketNumber,
          isWinning: false,
        }))
      )
      .returning();

    return createdTickets;
  }

  /**
   * Check if a ticket number is available for a campaign
   *
   * @param campaignId - Campaign ID
   * @param ticketNumber - 6-digit ticket number
   * @returns true if available, false if already taken
   */
  async isTicketNumberAvailable(
    campaignId: number,
    ticketNumber: string
  ): Promise<boolean> {
    if (!/^\d{6}$/.test(ticketNumber)) {
      return false;
    }

    const [existing] = await db
      .select()
      .from(tickets)
      .where(
        and(
          eq(tickets.campaignId, campaignId),
          eq(tickets.ticketNumber, ticketNumber)
        )
      )
      .limit(1);

    return !existing;
  }

  /**
   * Count tickets already purchased by a user for a campaign.
   * Used to enforce minimum_tickets only on first purchase.
   */
  async countByUserAndCampaign(userId: number, campaignId: number): Promise<number> {
    const [row] = await db
      .select({ count: count() })
      .from(tickets)
      .where(and(eq(tickets.userId, userId), eq(tickets.campaignId, campaignId)));
    return row?.count ?? 0;
  }

  /**
   * Get tickets by order ID (via order_tickets)
   */
  async getTicketsByOrderId(orderId: number): Promise<Ticket[]> {
    // Query order_tickets to get ticket IDs
    const orderTicketRecords = await db
      .select()
      .from(orderTickets)
      .where(eq(orderTickets.orderId, orderId));

    if (orderTicketRecords.length === 0) {
      return [];
    }

    // Get ticket IDs
    const ticketIds = orderTicketRecords.map((ot) => ot.ticketId);

    // Query tickets using IN clause
    const ticketRecords = await db
      .select()
      .from(tickets)
      .where(inArray(tickets.id, ticketIds));

    return ticketRecords;
  }
}

// Export singleton instance
export const ticketService = new TicketService();
