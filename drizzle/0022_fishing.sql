CREATE TABLE "fishing_catches" (
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"catch" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fishing_catches_user_id_date_pk" PRIMARY KEY("user_id","date"),
	CONSTRAINT "fishing_catches_catch_check" CHECK ("fishing_catches"."catch" in ('minnow', 'crucian', 'carp', 'golden_carp', 'feed', 'boot'))
);
--> statement-breakpoint
ALTER TABLE "point_ledger" DROP CONSTRAINT "point_ledger_reason_check";--> statement-breakpoint
ALTER TABLE "fishing_catches" ADD CONSTRAINT "fishing_catches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "point_ledger_fishing_uq" ON "point_ledger" USING btree ("user_id","ref_id") WHERE "point_ledger"."reason" = 'fishing';--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_reason_check" CHECK ("point_ledger"."reason" in ('signup', 'attendance', 'post', 'comment', 'like_received', 'purchase', 'farm_care', 'farm_grown', 'egg_purchase', 'growth_purchase', 'fishing'));