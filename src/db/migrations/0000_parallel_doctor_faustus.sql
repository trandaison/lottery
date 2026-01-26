CREATE TYPE "public"."campaign_status" AS ENUM('active', 'drawing', 'completed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('direct', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'success', 'failed');--> statement-breakpoint
CREATE TABLE "campaign_prizes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" bigint NOT NULL,
	"title" varchar(255) NOT NULL,
	"prizes_count" integer NOT NULL,
	"matching_digits" integer NOT NULL,
	"prize_value" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_prizes_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"ticket_price" integer NOT NULL,
	"payment_type" "payment_type" DEFAULT 'direct' NOT NULL,
	"bank_name_or_code" varchar(100),
	"account_number" varchar(50),
	"account_holder_name" varchar(255),
	"sepay_gateway" varchar(255),
	"status" "campaign_status" DEFAULT 'active' NOT NULL,
	"exclude_winning_numbers" boolean DEFAULT true NOT NULL,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "campaigns_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_digest" text,
	"phone" varchar(20),
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"ticket_number" varchar(6) NOT NULL,
	"is_winning" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "unique_campaign_ticket_number" UNIQUE("campaign_id","ticket_number")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"tickets_count" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"payment_reference_id" varchar(100) NOT NULL,
	"expires_at" timestamp with time zone,
	"payment_type" "payment_type" NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"sepay_transaction_id" varchar(255),
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "orders_payment_reference_id_unique" UNIQUE("payment_reference_id")
);
--> statement-breakpoint
CREATE TABLE "order_tickets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" bigint NOT NULL,
	"ticket_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_order_ticket" UNIQUE("order_id","ticket_id")
);
--> statement-breakpoint
CREATE TABLE "winning_numbers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"campaign_prize_id" bigint NOT NULL,
	"number" varchar(6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "winning_numbers_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
ALTER TABLE "campaign_prizes" ADD CONSTRAINT "campaign_prizes_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_tickets" ADD CONSTRAINT "order_tickets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_tickets" ADD CONSTRAINT "order_tickets_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "winning_numbers" ADD CONSTRAINT "winning_numbers_campaign_prize_id_campaign_prizes_id_fk" FOREIGN KEY ("campaign_prize_id") REFERENCES "public"."campaign_prizes"("id") ON DELETE cascade ON UPDATE no action;