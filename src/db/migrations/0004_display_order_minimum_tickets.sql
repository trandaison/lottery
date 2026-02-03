-- campaign_prizes: display_order for prize ordering
ALTER TABLE "campaign_prizes" ADD COLUMN IF NOT EXISTS "display_order" integer NOT NULL DEFAULT 0;

-- Backfill display_order to preserve current order (matching_digits, created_at)
UPDATE campaign_prizes SET display_order = sub.rn - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY campaign_id ORDER BY matching_digits, created_at) AS rn
  FROM campaign_prizes
) AS sub
WHERE campaign_prizes.id = sub.id;

-- campaigns: minimum_tickets for first-time purchase
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "minimum_tickets" integer NOT NULL DEFAULT 1;
