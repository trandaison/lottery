ALTER TABLE "orders" ADD COLUMN "transaction_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaigns" DROP COLUMN "account_holder_name";--> statement-breakpoint
ALTER TABLE "campaigns" DROP COLUMN "sepay_gateway";