ALTER TABLE "campaign_prizes" ALTER COLUMN "prize_value" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "campaign_prizes" ADD COLUMN "prize_value_percent" integer;--> statement-breakpoint
ALTER TABLE "campaign_prizes" ADD COLUMN "display_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "minimum_tickets" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "prize_value_type" varchar(20) DEFAULT 'fixed' NOT NULL;