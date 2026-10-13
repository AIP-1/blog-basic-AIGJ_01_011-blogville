CREATE TABLE "avatar_equips" (
	"user_id" text NOT NULL,
	"slot" text NOT NULL,
	"item_id" integer NOT NULL,
	CONSTRAINT "avatar_equips_user_id_slot_pk" PRIMARY KEY("user_id","slot"),
	CONSTRAINT "avatar_equips_slot_check" CHECK ("avatar_equips"."slot" in ('hat', 'clothes', 'accessory'))
);
--> statement-breakpoint
ALTER TABLE "blogs" ADD COLUMN "background_item_id" integer;--> statement-breakpoint
ALTER TABLE "avatar_equips" ADD CONSTRAINT "avatar_equips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatar_equips" ADD CONSTRAINT "avatar_equips_owned_fk" FOREIGN KEY ("user_id","item_id") REFERENCES "public"."user_items"("user_id","item_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_background_owned_fk" FOREIGN KEY ("owner_id","background_item_id") REFERENCES "public"."user_items"("user_id","item_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- 기본 배경 초원 (SHOP-04). 가입할 때 받아 장착한다
INSERT INTO "items" ("code", "type", "name", "description", "art", "price", "required_level", "is_starter", "is_on_sale") VALUES
  ('bg_meadow', 'background', '초원', '바람이 살랑이는 푸른 들판.', 'bg.meadow', 0, 1, true, false);--> statement-breakpoint
INSERT INTO "user_items" ("user_id", "item_id") SELECT u."id", i."id" FROM "users" u, "items" i WHERE i."code" = 'bg_meadow';--> statement-breakpoint
UPDATE "blogs" SET "background_item_id" = (SELECT "id" FROM "items" WHERE "code" = 'bg_meadow');
