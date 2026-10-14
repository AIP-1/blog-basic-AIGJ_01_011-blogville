CREATE TABLE "food_saved" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "food_saved_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"place_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"map_url" text DEFAULT '' NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "food_saved_user_place_unique" UNIQUE("user_id","place_id"),
	CONSTRAINT "food_saved_place_id_check" CHECK (char_length("food_saved"."place_id") between 1 and 200),
	CONSTRAINT "food_saved_name_check" CHECK (char_length("food_saved"."name") between 1 and 100)
);
--> statement-breakpoint
ALTER TABLE "food_saved" ADD CONSTRAINT "food_saved_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "food_saved_user_created_idx" ON "food_saved" USING btree ("user_id","created_at" DESC NULLS LAST);