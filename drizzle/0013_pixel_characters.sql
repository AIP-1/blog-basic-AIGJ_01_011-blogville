CREATE TABLE "items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"art" text NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"is_starter" boolean DEFAULT false NOT NULL,
	"is_on_sale" boolean DEFAULT false NOT NULL,
	CONSTRAINT "items_code_unique" UNIQUE("code"),
	CONSTRAINT "items_type_check" CHECK ("items"."type" in ('character')),
	CONSTRAINT "items_price_check" CHECK ("items"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_items" (
	"user_id" text NOT NULL,
	"item_id" integer NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_items_user_id_item_id_pk" PRIMARY KEY("user_id","item_id")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "character_item_id" integer;--> statement-breakpoint
ALTER TABLE "user_items" ADD CONSTRAINT "user_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_items" ADD CONSTRAINT "user_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_items_item_idx" ON "user_items" USING btree ("item_id");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_character_owned_fk" FOREIGN KEY ("user_id","character_item_id") REFERENCES "public"."user_items"("user_id","item_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- 기본 캐릭터 2종 (GAME-01). 캐릭터는 팔지 않는다
INSERT INTO "items" ("code", "type", "name", "art", "is_starter", "is_on_sale") VALUES
  ('char_boy', 'character', '남자 주민', 'char.boy', true, false),
  ('char_girl', 'character', '여자 주민', 'char.girl', true, false);--> statement-breakpoint
-- 캐릭터가 생기기 전에 가입한 회원은 남자 주민(가입 화면의 처음 고른 값)을 받아 장착한다
INSERT INTO "user_items" ("user_id", "item_id") SELECT u."id", i."id" FROM "users" u, "items" i WHERE i."code" = 'char_boy';--> statement-breakpoint
UPDATE "profiles" SET "character_item_id" = (SELECT "id" FROM "items" WHERE "code" = 'char_boy');
