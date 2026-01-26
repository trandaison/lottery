import {
  pgTable,
  bigserial,
  uuid,
  bigint,
  varchar,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { campaignPrizes } from './campaign-prizes';

export const winningNumbers = pgTable(
  'winning_numbers',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    uuid: uuid('uuid')
      .notNull()
      .unique()
      .default(sql`gen_random_uuid()`),
    campaignPrizeId: bigint('campaign_prize_id', { mode: 'number' })
      .notNull()
      .references(() => campaignPrizes.id, { onDelete: 'cascade' }),
    number: varchar('number', { length: 6 }).notNull(), // WITHOUT left-padding
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('idx_winning_numbers_campaign_prize_id').on(table.campaignPrizeId),
  ],
);

export type WinningNumber = typeof winningNumbers.$inferSelect;
export type NewWinningNumber = typeof winningNumbers.$inferInsert;
