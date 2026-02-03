-- campaign_prizes: prize_value as string (display), prize_value_type, prize_value_percent
ALTER TABLE "campaign_prizes" ADD COLUMN IF NOT EXISTS "prize_value_type" varchar(20) NOT NULL DEFAULT 'fixed';
ALTER TABLE "campaign_prizes" ADD COLUMN IF NOT EXISTS "prize_value_percent" integer;

-- Convert prize_value from integer to varchar (cast existing values to text)
ALTER TABLE "campaign_prizes" ALTER COLUMN "prize_value" TYPE varchar(255) USING prize_value::text;
