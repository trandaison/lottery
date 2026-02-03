-- campaign_prizes: prize_value as varchar (display), prize_value_percent for % revenue
-- prize_value_type lives on campaigns (see 0006), not here
ALTER TABLE "campaign_prizes" ADD COLUMN IF NOT EXISTS "prize_value_percent" integer;
ALTER TABLE "campaign_prizes" ALTER COLUMN "prize_value" TYPE varchar(255) USING prize_value::text;
