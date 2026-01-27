import { db } from '@/db';
import {
  orders,
  orderTickets,
  type Order,
  type NewOrder,
  type OrderTicket,
} from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { ticketService } from './ticket.service';

/**
 * Order Service
 *
 * Handles order-related business logic including:
 * - Order creation
 * - Payment reference ID generation (LTR format)
 * - Expires_at calculation
 * - Status updates
 * - Order_tickets linking
 *
 * Architecture Principles:
 * - Uses BIGINT IDs for internal operations
 * - Generates UUIDs automatically via database
 * - Payment reference ID format: LTR + 6 digits (e.g., "LTR000001")
 * - Follows clean code and single responsibility principle
 */
export class OrderService {
  /**
   * Generate payment reference ID in format: LTR + 6 digits
   * Algorithm: Counter-based generation
   * 1. Query highest existing payment_reference_id matching pattern
   * 2. Extract number part and increment by 1
   * 3. If no orders exist yet, start from "LTR000001"
   * 4. Format: LTR${number.toString().padStart(6, '0')}
   *
   * @returns Payment reference ID (e.g., "LTR000001", "LTR102969")
   */
  async generatePaymentReferenceId(): Promise<string> {
    // Find highest existing payment_reference_id matching LTR pattern
    const [highestOrder] = await db
      .select({
        paymentReferenceId: orders.paymentReferenceId,
      })
      .from(orders)
      .where(sql`${orders.paymentReferenceId} ~ '^LTR\\d{6}$'`)
      .orderBy(desc(orders.paymentReferenceId))
      .limit(1);

    let nextNumber = 1;

    if (highestOrder?.paymentReferenceId) {
      // Extract number part (e.g., "LTR102969" -> 102969)
      const numberPart = highestOrder.paymentReferenceId.replace('LTR', '');
      const parsedNumber = parseInt(numberPart, 10);

      if (!isNaN(parsedNumber)) {
        nextNumber = parsedNumber + 1;
      }
    }

    // Format: LTR + 6 digits
    const paymentReferenceId = `LTR${nextNumber.toString().padStart(6, '0')}`;

    // Ensure uniqueness (retry if collision occurs)
    const [existing] = await db
      .select()
      .from(orders)
      .where(eq(orders.paymentReferenceId, paymentReferenceId))
      .limit(1);

    if (existing) {
      // Retry with incremented number
      return this.generatePaymentReferenceId();
    }

    return paymentReferenceId;
  }

  /**
   * Create a new order
   *
   * @param orderData - Order data
   * @returns Created order
   */
  async create(orderData: {
    campaignId: number;
    userId: number;
    ticketsCount: number;
    totalAmount: number;
    paymentType: 'direct' | 'transfer';
  }): Promise<Order> {
    // Generate payment reference ID
    const paymentReferenceId = await this.generatePaymentReferenceId();

    // Calculate expires_at (now + 10 minutes, for transfer only)
    const expiresAt =
      orderData.paymentType === 'transfer'
        ? new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        : null;

    // Create order
    const [order] = await db
      .insert(orders)
      .values({
        campaignId: orderData.campaignId,
        userId: orderData.userId,
        ticketsCount: orderData.ticketsCount,
        totalAmount: orderData.totalAmount,
        paymentReferenceId,
        paymentType: orderData.paymentType,
        paymentStatus: 'pending',
        expiresAt,
      })
      .returning();

    return order;
  }

  /**
   * Get order by payment reference ID
   *
   * @param paymentReferenceId - Payment reference ID (e.g., "LTR000001")
   * @returns Order with tickets if available
   */
  async getByPaymentReferenceId(
    paymentReferenceId: string
  ): Promise<Order & { tickets?: Array<{ id: number; ticketNumber: string }> } | null> {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.paymentReferenceId, paymentReferenceId))
      .limit(1);

    if (!order) {
      return null;
    }

    // Get tickets for this order
    const tickets = await ticketService.getTicketsByOrderId(order.id);

    return {
      ...order,
      tickets: tickets.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
      })),
    };
  }

  /**
   * Get order by ID
   */
  async getById(id: number): Promise<Order | null> {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    return order || null;
  }

  /**
   * Update order payment status
   *
   * @param id - Order ID
   * @param status - New payment status
   * @param additionalData - Additional fields to update (sepayTransactionId, receivedAt, etc.)
   * @returns Updated order
   */
  async updatePaymentStatus(
    id: number,
    status: 'pending' | 'success' | 'failed',
    additionalData?: {
      sepayTransactionId?: string;
      receivedAt?: Date;
      transactionDate?: Date;
      errorMessage?: string;
    }
  ): Promise<Order> {
    const [updated] = await db
      .update(orders)
      .set({
        paymentStatus: status,
        ...additionalData,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();

    return updated;
  }

  /**
   * Create tickets for an order and link them via order_tickets
   * This is used when payment is successful (direct or after webhook)
   *
   * @param orderId - Order ID
   * @returns Created tickets
   */
  async createTicketsForOrder(orderId: number): Promise<Array<{ id: number; ticketNumber: string }>> {
    // Get order
    const order = await this.getById(orderId);
    if (!order) {
      throw new Error('ORDER_NOT_FOUND');
    }

    if (order.paymentStatus !== 'success') {
      throw new Error('ORDER_NOT_PAID: Cannot create tickets for unpaid order');
    }

    // Check if tickets already exist for this order
    const existingTickets = await ticketService.getTicketsByOrderId(orderId);
    if (existingTickets.length > 0) {
      // Tickets already created, return them
      return existingTickets.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
      }));
    }

    // Generate unique ticket numbers
    const ticketNumbers = await ticketService.generateUniqueTicketNumbers(
      order.campaignId,
      order.ticketsCount
    );

    // Create tickets
    const createdTickets = await ticketService.createTickets(
      ticketNumbers.map((ticketNumber) => ({
        campaignId: order.campaignId,
        userId: order.userId,
        ticketNumber,
      }))
    );

    // Link tickets to order via order_tickets
    await db.insert(orderTickets).values(
      createdTickets.map((ticket) => ({
        orderId: order.id,
        ticketId: ticket.id,
      }))
    );

    return createdTickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
    }));
  }

  /**
   * Check if order has expired (for transfer payments)
   *
   * @param order - Order object
   * @returns true if expired, false otherwise
   */
  isExpired(order: Order): boolean {
    if (!order.expiresAt) {
      return false; // Direct payments don't expire
    }

    return new Date() > new Date(order.expiresAt);
  }
}

// Export singleton instance
export const orderService = new OrderService();
