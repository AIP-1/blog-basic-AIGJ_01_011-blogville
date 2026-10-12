ALTER TABLE "items" DROP CONSTRAINT "items_type_check";--> statement-breakpoint
ALTER TABLE "point_ledger" DROP CONSTRAINT "point_ledger_reason_check";--> statement-breakpoint
ALTER TABLE "point_ledger" DROP CONSTRAINT "point_ledger_purchase_check";--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "growth_value" integer;--> statement-breakpoint
ALTER TABLE "user_items" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_growth_check" CHECK (("items"."type" = 'growth') = ("items"."growth_value" is not null) and ("items"."growth_value" is null or "items"."growth_value" > 0));--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_type_check" CHECK ("items"."type" in ('character', 'hat', 'clothes', 'accessory', 'furniture', 'background', 'growth'));--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_reason_check" CHECK ("point_ledger"."reason" in ('signup', 'attendance', 'post', 'comment', 'like_received', 'purchase', 'farm_care', 'farm_grown', 'egg_purchase', 'growth_purchase'));--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_purchase_check" CHECK (("point_ledger"."reason" in ('purchase', 'egg_purchase', 'growth_purchase')) = ("point_ledger"."coin_delta" < 0) and ("point_ledger"."reason" not in ('purchase', 'egg_purchase', 'growth_purchase') or "point_ledger"."exp_delta" = 0));--> statement-breakpoint
ALTER TABLE "user_items" ADD CONSTRAINT "user_items_quantity_check" CHECK ("user_items"."quantity" >= 1);--> statement-breakpoint
-- 성장 아이템 (SHOP-01, TOWN-09): 여러 개 살 수 있고 농장에서 하나씩 쓴다
INSERT INTO "items" ("code", "type", "name", "description", "art", "price", "required_level", "is_on_sale", "growth_value") VALUES
  ('growth_feed', 'growth', '동물 먹이', '농장 동물이 좋아하는 곡물 먹이. 성장 +20.', 'growth.feed', 20, 1, true, 20),
  ('growth_feed_plus', 'growth', '고급 먹이', '영양 가득 고급 먹이. 성장 +50.', 'growth.feed_plus', 60, 1, true, 50),
  ('growth_booster', 'growth', '성장 촉진제', '쑥쑥 자라는 마법의 물약. 성장 +100.', 'growth.booster', 150, 3, true, 100);
