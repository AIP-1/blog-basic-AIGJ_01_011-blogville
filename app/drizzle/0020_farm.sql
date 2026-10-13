CREATE TABLE "animal_cares" (
	"animal_id" integer NOT NULL,
	"action" text NOT NULL,
	"date" date NOT NULL,
	CONSTRAINT "animal_cares_animal_id_action_date_pk" PRIMARY KEY("animal_id","action","date"),
	CONSTRAINT "animal_cares_action_check" CHECK ("animal_cares"."action" in ('feed', 'water', 'pet'))
);
--> statement-breakpoint
CREATE TABLE "animals" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "animals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"species" text,
	"source" text NOT NULL,
	"source_level" integer,
	"growth" integer DEFAULT 0 NOT NULL,
	"hatched_at" timestamp with time zone,
	"grown_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "animals_species_check" CHECK ("animals"."species" in ('chick', 'rabbit', 'piglet', 'calf')),
	CONSTRAINT "animals_source_check" CHECK ("animals"."source" in ('first', 'level', 'buy') and ("animals"."source" = 'level') = ("animals"."source_level" is not null) and ("animals"."source_level" is null or ("animals"."source_level" > 0 and "animals"."source_level" % 5 = 0))),
	CONSTRAINT "animals_egg_check" CHECK (("animals"."species" is null) = ("animals"."hatched_at" is null) and ("animals"."species" is not null or ("animals"."growth" = 0 and "animals"."grown_at" is null))),
	CONSTRAINT "animals_growth_check" CHECK ("animals"."growth" >= 0)
);
--> statement-breakpoint
ALTER TABLE "point_ledger" DROP CONSTRAINT "point_ledger_reason_check";--> statement-breakpoint
ALTER TABLE "point_ledger" DROP CONSTRAINT "point_ledger_purchase_check";--> statement-breakpoint
ALTER TABLE "animal_cares" ADD CONSTRAINT "animal_cares_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "animals_user_idx" ON "animals" USING btree ("user_id","grown_at");--> statement-breakpoint
CREATE UNIQUE INDEX "animals_first_egg_uq" ON "animals" USING btree ("user_id") WHERE "animals"."source" = 'first';--> statement-breakpoint
CREATE UNIQUE INDEX "animals_level_egg_uq" ON "animals" USING btree ("user_id","source_level") WHERE "animals"."source" = 'level';--> statement-breakpoint
CREATE UNIQUE INDEX "point_ledger_farm_uq" ON "point_ledger" USING btree ("user_id","reason","ref_id") WHERE "point_ledger"."reason" in ('farm_grown', 'egg_purchase');--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_reason_check" CHECK ("point_ledger"."reason" in ('signup', 'attendance', 'post', 'comment', 'like_received', 'purchase', 'farm_care', 'farm_grown', 'egg_purchase'));--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_purchase_check" CHECK (("point_ledger"."reason" in ('purchase', 'egg_purchase')) = ("point_ledger"."coin_delta" < 0) and ("point_ledger"."reason" not in ('purchase', 'egg_purchase') or "point_ledger"."exp_delta" = 0));