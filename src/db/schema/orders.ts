import {
  pgTable,
  bigserial,
  uuid,
  bigint,
  integer,
  varchar,
  text,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { campaigns } from './campaigns';
import { users } from './users';
import { paymentTypeEnum } from './campaigns';

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'success',
  'failed',
]);

export const orders = pgTable(
  'orders',
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
    ticketsCount: integer('tickets_count').notNull(),
    totalAmount: integer('total_amount').notNull(), // VND
    paymentReferenceId: varchar('payment_reference_id', { length: 100 })
      .notNull()
      .unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }), // For transfer payments
    paymentType: paymentTypeEnum('payment_type').notNull(),
    paymentStatus: paymentStatusEnum('payment_status')
      .notNull()
      .default('pending'),
    errorMessage: text('error_message'),
    sepayTransactionId: varchar('sepay_transaction_id', { length: 255 }),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    transactionDate: timestamp('transaction_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('idx_orders_campaign_id').on(table.campaignId),
    index('idx_orders_user_id').on(table.userId),
    index('idx_orders_payment_reference_id').on(table.paymentReferenceId),
    index('idx_orders_payment_status').on(table.paymentStatus),
  ],
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
