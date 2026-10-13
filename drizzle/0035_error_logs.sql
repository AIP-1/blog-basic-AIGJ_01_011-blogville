CREATE TABLE "error_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "error_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"digest" text,
	"message" text NOT NULL,
	"stack" text,
	"route_path" text,
	"route_type" text,
	"method" text,
	"url" text,
	"user_agent" text,
	"count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "error_logs_message_check" CHECK (char_length("error_logs"."message") <= 1000),
	CONSTRAINT "error_logs_stack_check" CHECK ("error_logs"."stack" is null or char_length("error_logs"."stack") <= 4000),
	CONSTRAINT "error_logs_user_agent_check" CHECK ("error_logs"."user_agent" is null or char_length("error_logs"."user_agent") <= 300),
	CONSTRAINT "error_logs_count_check" CHECK ("error_logs"."count" >= 1)
);
--> statement-breakpoint
CREATE INDEX "error_logs_last_seen_idx" ON "error_logs" USING btree ("last_seen_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "error_logs_group_idx" ON "error_logs" USING btree ("route_path","digest","last_seen_at");