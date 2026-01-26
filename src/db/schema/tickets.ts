import {
  pgTable,
  bigserial,
  uuid,
  bigint,
  varchar,
  boolean,
  timestamp,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { campaigns } from './campaigns';
import { users } from './users';

export const tickets = pgTable(
  'tickets',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    uuid: uuid('uuid')
      .notNull()
      .unique()
      .default(sql`gen_random_uuid()`),
    campaignId: bigint('campaign_id', { mode: 'number' })
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ticketNumber: varchar('ticket_number', { length: 6 }).notNull(),
    isWinning: boolean('is_winning').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique('unique_campaign_ticket_number').on(
      table.campaignId,
      table.ticketNumber,
    ),
    index('idx_tickets_campaign_id').on(table.campaignId),
    index('idx_tickets_user_id').on(table.userId),
    index('idx_tickets_ticket_number').on(table.ticketNumber),
    index('idx_tickets_is_winning').on(table.isWinning),
  ],
);

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
