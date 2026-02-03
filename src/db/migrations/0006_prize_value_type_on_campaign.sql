-- prize_value_type on campaigns (applies to all prizes in the campaign)
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "prize_value_type" varchar(20) NOT NULL DEFAULT 'fixed';
