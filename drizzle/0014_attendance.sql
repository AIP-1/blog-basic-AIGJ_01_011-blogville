CREATE TABLE "attendance_rewards" (
	"day" integer PRIMARY KEY NOT NULL,
	"exp" integer NOT NULL,
	"coins" integer NOT NULL,
	CONSTRAINT "attendance_rewards_day_check" CHECK ("attendance_rewards"."day" between 1 and 7),
	CONSTRAINT "attendance_rewards_amount_check" CHECK ("attendance_rewards"."exp" >= 0 and "attendance_rewards"."coins" >= 0 and ("attendance_rewards"."exp" > 0 or "attendance_rewards"."coins" > 0))
);
--> statement-breakpoint
CREATE TABLE "attendances" (
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"cycle_day" integer NOT NULL,
	"session_id" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendances_user_id_date_pk" PRIMARY KEY("user_id","date"),
	CONSTRAINT "attendances_cycle_day_check" CHECK ("attendances"."cycle_day" between 1 and 7)
);
--> statement-breakpoint
ALTER TABLE "point_ledger" DROP CONSTRAINT "point_ledger_reason_check";--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_cycle_day_attendance_rewards_day_fk" FOREIGN KEY ("cycle_day") REFERENCES "public"."attendance_rewards"("day") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendances_session_idx" ON "attendances" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "point_ledger_attendance_uq" ON "point_ledger" USING btree ("user_id","ref_id") WHERE "point_ledger"."reason" = 'attendance';--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_reason_check" CHECK ("point_ledger"."reason" in ('signup', 'attendance', 'post', 'comment', 'like_received'));--> statement-breakpoint
-- 7일 주기 보상표 (GAME-04)
INSERT INTO "attendance_rewards" ("day", "exp", "coins") VALUES (1, 10, 10), (2, 10, 20), (3, 15, 30), (4, 15, 40), (5, 20, 50), (6, 20, 70), (7, 30, 100);
