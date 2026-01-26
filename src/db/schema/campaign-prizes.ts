import {
  pgTable,
  bigserial,
  uuid,
  bigint,
  varchar,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { campaigns } from './campaigns';

export const campaignPrizes = pgTable(
  'campaign_prizes',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    uuid: uuid('uuid')
      .notNull()
      .unique()
      .default(sql`gen_random_uuid()`),
    campaignId: bigint('campaign_id', { mode: 'number' })
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    prizesCount: integer('prizes_count').notNull(),
    matchingDigits: integer('matching_digits').notNull(), // 1-6
    prizeValue: integer('prize_value').notNull(), // VND
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('idx_campaign_prizes_campaign_id').on(table.campaignId),
    index('idx_campaign_prizes_matching_digits').on(table.matchingDigits),
  ],
);

export type CampaignPrize = typeof campaignPrizes.$inferSelect;
export type NewCampaignPrize = typeof campaignPrizes.$inferInsert;
