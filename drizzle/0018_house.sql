CREATE TABLE "house_furniture" (
	"user_id" text NOT NULL,
	"slot" integer NOT NULL,
	"item_id" integer NOT NULL,
	CONSTRAINT "house_furniture_user_id_slot_pk" PRIMARY KEY("user_id","slot"),
	CONSTRAINT "house_furniture_item_uq" UNIQUE("user_id","item_id"),
	CONSTRAINT "house_furniture_slot_check" CHECK ("house_furniture"."slot" between 0 and 7)
);
--> statement-breakpoint
ALTER TABLE "house_furniture" ADD CONSTRAINT "house_furniture_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_furniture" ADD CONSTRAINT "house_furniture_owned_fk" FOREIGN KEY ("user_id","item_id") REFERENCES "public"."user_items"("user_id","item_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- 기본 가구 (SHOP-05): 가입할 때 받아 우리 집 0·1번 칸에 놓인다
INSERT INTO "items" ("code", "type", "name", "description", "art", "price", "required_level", "is_starter", "is_on_sale") VALUES
  ('furn_plant', 'furniture', '초록 화분', '방에 생기를 주는 작은 화분.', 'furn.plant', 0, 1, true, false),
  ('furn_chair', 'furniture', '나무 의자', '튼튼한 나무 의자.', 'furn.chair', 0, 1, true, false);--> statement-breakpoint
INSERT INTO "user_items" ("user_id", "item_id") SELECT u."id", i."id" FROM "users" u, "items" i WHERE i."code" IN ('furn_plant', 'furn_chair');--> statement-breakpoint
INSERT INTO "house_furniture" ("user_id", "slot", "item_id")
  SELECT u."id", CASE i."code" WHEN 'furn_plant' THEN 0 ELSE 1 END, i."id" FROM "users" u, "items" i WHERE i."code" IN ('furn_plant', 'furn_chair');
