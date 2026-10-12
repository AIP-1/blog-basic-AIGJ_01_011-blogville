CREATE TABLE "point_ledger" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "point_ledger_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"exp_delta" integer DEFAULT 0 NOT NULL,
	"coin_delta" integer DEFAULT 0 NOT NULL,
	"ref_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "point_ledger_reason_check" CHECK ("point_ledger"."reason" in ('signup', 'post', 'comment', 'like_received')),
	CONSTRAINT "point_ledger_exp_check" CHECK ("point_ledger"."exp_delta" >= 0),
	CONSTRAINT "point_ledger_nonzero_check" CHECK ("point_ledger"."exp_delta" <> 0 or "point_ledger"."coin_delta" <> 0)
);
--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "point_ledger_user_reason_created_idx" ON "point_ledger" USING btree ("user_id","reason","created_at");--> statement-breakpoint
CREATE INDEX "point_ledger_user_created_idx" ON "point_ledger" USING btree ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "point_ledger_like_received_uq" ON "point_ledger" USING btree ("user_id","ref_id") WHERE "point_ledger"."reason" = 'like_received';--> statement-breakpoint
CREATE UNIQUE INDEX "point_ledger_signup_uq" ON "point_ledger" USING btree ("user_id") WHERE "point_ledger"."reason" = 'signup';--> statement-breakpoint
-- 원장이 생기기 전에 가입한 회원도 가입 축하 🪙 100을 받는다 (가입 시각으로)
INSERT INTO "point_ledger" ("user_id", "reason", "coin_delta", "created_at") SELECT "id", 'signup', 100, "created_at" FROM "users";
