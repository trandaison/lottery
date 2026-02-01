import { db } from '@/db';
import {
  orders,
  orderTickets,
  users,
  type Order,
  type NewOrder,
  type OrderTicket,
} from '@/db/schema';
import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';
import { ticketService } from './ticket.service';
import { userService } from './user.service';
import { campaignService } from './campaign.service';
import { emailService } from './email.service';

export type OrderSortBy = 'createdAt' | 'paymentStatus' | 'userId' | 'ticketsCount';

export interface ListOrdersByCampaignFilters {
  status?: 'pending' | 'success' | 'failed';
  page?: number;
  limit?: number;
  sortBy?: OrderSortBy;
  sortOrder?: 'asc' | 'desc';
}

export interface OrderWithUser extends Order {
  user: { id: number; name: string; email: string };
}

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

  /**
   * List orders by campaign ID with optional filters, pagination, and sort.
   */
  async listByCampaign(
    campaignId: number,
    filters: ListOrdersByCampaignFilters = {}
  ): Promise<{ orders: OrderWithUser[]; total: number }> {
    const {
      status,
      page = 1,
      limit = 30,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const conditions = [eq(orders.campaignId, campaignId)];
    if (status) {
      conditions.push(eq(orders.paymentStatus, status));
    }
    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    const orderByColumn =
      sortBy === 'paymentStatus'
        ? orders.paymentStatus
        : sortBy === 'userId'
          ? orders.userId
          : sortBy === 'ticketsCount'
            ? orders.ticketsCount
            : orders.createdAt;
    const orderBy = sortOrder === 'asc' ? asc(orderByColumn) : desc(orderByColumn);

    const offset = (page - 1) * limit;

    const rows = await db
      .select({
        id: orders.id,
        uuid: orders.uuid,
        campaignId: orders.campaignId,
        userId: orders.userId,
        ticketsCount: orders.ticketsCount,
        totalAmount: orders.totalAmount,
        paymentReferenceId: orders.paymentReferenceId,
        expiresAt: orders.expiresAt,
        paymentType: orders.paymentType,
        paymentStatus: orders.paymentStatus,
        errorMessage: orders.errorMessage,
        sepayTransactionId: orders.sepayTransactionId,
        receivedAt: orders.receivedAt,
        transactionDate: orders.transactionDate,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    const ordersWithUser: OrderWithUser[] = rows.map((row) => {
      const { userName, userEmail, ...orderFields } = row;
      return {
        ...orderFields,
        user: { id: row.userId, name: userName, email: userEmail },
      } as OrderWithUser;
    });

    return { orders: ordersWithUser, total };
  }

  /**
   * Mark order as success manually (admin). Updates status only (no webhook fields),
   * then creates tickets and sends email like webhook flow.
   */
  async markAsSuccessManually(orderId: number): Promise<Order> {
    const order = await this.getById(orderId);
    if (!order) {
      throw new Error('ORDER_NOT_FOUND');
    }
    if (order.paymentStatus !== 'pending') {
      throw new Error('ORDER_NOT_PENDING: Only pending orders can be marked success manually');
    }

    await db
      .update(orders)
      .set({
        paymentStatus: 'success',
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    const createdTickets = await this.createTicketsForOrder(orderId);

    const [user, campaign] = await Promise.all([
      userService.getById(order.userId),
      campaignService.getById(order.campaignId),
    ]);
    const fullTickets = await ticketService.getTicketsByOrderId(orderId);
    if (user && campaign && fullTickets.length > 0) {
      emailService
        .sendTicketEmail(order, user, campaign, fullTickets)
        .catch((err) => console.error('[OrderService] markAsSuccessManually email failed', err));
    }

    const [updated] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    return updated!;
  }

  /**
   * Delete a single order (cascade removes order_tickets).
   */
  async delete(id: number): Promise<void> {
    await db.delete(orders).where(eq(orders.id, id));
  }

  /**
   * Delete multiple orders by IDs.
   */
  async deleteMany(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;
    const deleted = await db
      .delete(orders)
      .where(inArray(orders.id, ids))
      .returning({ id: orders.id });
    return deleted.length;
  }
}

// Export singleton instance
export const orderService = new OrderService();
