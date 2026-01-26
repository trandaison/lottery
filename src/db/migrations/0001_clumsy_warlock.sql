CREATE INDEX "idx_campaign_prizes_campaign_id" ON "campaign_prizes" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_prizes_matching_digits" ON "campaign_prizes" USING btree ("matching_digits");--> statement-breakpoint
CREATE INDEX "idx_campaigns_slug" ON "campaigns" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_campaigns_status" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_campaigns_start_time" ON "campaigns" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_tickets_campaign_id" ON "tickets" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_tickets_user_id" ON "tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tickets_ticket_number" ON "tickets" USING btree ("ticket_number");--> statement-breakpoint
CREATE INDEX "idx_tickets_is_winning" ON "tickets" USING btree ("is_winning");--> statement-breakpoint
CREATE INDEX "idx_orders_campaign_id" ON "orders" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_orders_user_id" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_orders_payment_reference_id" ON "orders" USING btree ("payment_reference_id");--> statement-breakpoint
CREATE INDEX "idx_orders_payment_status" ON "orders" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "idx_order_tickets_order_id" ON "order_tickets" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_order_tickets_ticket_id" ON "order_tickets" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_winning_numbers_campaign_prize_id" ON "winning_numbers" USING btree ("campaign_prize_id");