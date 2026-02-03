-- Move prize_value_type from campaign_prizes to campaigns (no backfill)
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "prize_value_type" varchar(20) NOT NULL DEFAULT 'fixed';
ALTER TABLE "campaign_prizes" DROP COLUMN IF EXISTS "prize_value_type";
