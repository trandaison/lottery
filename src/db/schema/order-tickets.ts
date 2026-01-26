import {
  pgTable,
  bigserial,
  bigint,
  timestamp,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { orders } from './orders';
import { tickets } from './tickets';

export const orderTickets = pgTable(
  'order_tickets',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orderId: bigint('order_id', { mode: 'number' })
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    ticketId: bigint('ticket_id', { mode: 'number' })
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique('unique_order_ticket').on(table.orderId, table.ticketId),
    index('idx_order_tickets_order_id').on(table.orderId),
    index('idx_order_tickets_ticket_id').on(table.ticketId),
  ],
);

export type OrderTicket = typeof orderTickets.$inferSelect;
export type NewOrderTicket = typeof orderTickets.$inferInsert;
