import {
  pgTable,
  bigserial,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  pgEnum,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const campaignStatusEnum = pgEnum('campaign_status', [
  'active',
  'drawing',
  'completed',
  'canceled',
]);

export const paymentTypeEnum = pgEnum('payment_type', ['direct', 'transfer']);

export const campaigns = pgTable(
  'campaigns',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    uuid: uuid('uuid')
      .notNull()
      .unique()
      .default(sql`gen_random_uuid()`),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    description: text('description'),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    ticketPrice: integer('ticket_price').notNull(), // VND
    minimumTickets: integer('minimum_tickets').notNull().default(1),
    paymentType: paymentTypeEnum('payment_type').notNull().default('direct'),
    bankNameOrCode: varchar('bank_name_or_code', { length: 100 }),
    accountNumber: varchar('account_number', { length: 50 }),
    webhookApiKey: text('webhook_api_key'), // JWT token for SePay webhook authentication
    status: campaignStatusEnum('status').notNull().default('active'),
    prizeValueType: varchar('prize_value_type', { length: 20 }).notNull().default('fixed'), // 'fixed' | 'percent'
    excludeWinningNumbers: boolean('exclude_winning_numbers')
      .notNull()
      .default(true),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('idx_campaigns_slug').on(table.slug),
    index('idx_campaigns_status').on(table.status),
    index('idx_campaigns_start_time').on(table.startTime),
  ],
);

export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
