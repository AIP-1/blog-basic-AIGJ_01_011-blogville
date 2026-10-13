ALTER TABLE "avatar_equips" DROP CONSTRAINT "avatar_equips_slot_check";--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_type_check";--> statement-breakpoint
ALTER TABLE "avatar_equips" ADD CONSTRAINT "avatar_equips_slot_check" CHECK ("avatar_equips"."slot" in ('hat', 'clothes', 'accessory', 'hair', 'hair_color'));--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_type_check" CHECK ("items"."type" in ('character', 'hat', 'clothes', 'accessory', 'furniture', 'background', 'growth', 'hair', 'hair_color'));--> statement-breakpoint
-- 미용실 (SHOP-07, specs/052-salon): 머리 모양 7가지·머리 색 8가지. 미용실에서만 고른다(상점에는 없다). 무료는 is_on_sale 거짓
INSERT INTO "items" ("code", "type", "name", "description", "art", "price", "required_level", "is_on_sale") VALUES
  ('hair_short', 'hair', '짧은 머리', '단정하게 짧은 머리.', 'hair.short', 0, 1, false),
  ('hair_bob', 'hair', '단발', '턱선에서 찰랑이는 단발.', 'hair.bob', 0, 1, false),
  ('hair_spiky', 'hair', '삐죽 머리', '하늘로 솟은 삐죽 머리.', 'hair.spiky', 40, 1, true),
  ('hair_ponytail', 'hair', '포니테일', '높게 묶은 포니테일.', 'hair.ponytail', 60, 1, true),
  ('hair_long', 'hair', '긴 생머리', '허리까지 내려오는 생머리.', 'hair.long', 80, 2, true),
  ('hair_bun', 'hair', '똥머리', '머리 위에 동그랗게 올린 똥머리.', 'hair.bun', 90, 2, true),
  ('hair_perm', 'hair', '뽀글 파마', '보글보글 귀여운 파마.', 'hair.perm', 120, 3, true),
  ('haircolor_brown', 'hair_color', '밤색', '따뜻한 밤색.', 'haircolor.brown', 0, 1, false),
  ('haircolor_black', 'hair_color', '흑발', '윤기 나는 검은 머리.', 'haircolor.black', 0, 1, false),
  ('haircolor_blond', 'hair_color', '금발', '햇살 같은 금발.', 'haircolor.blond', 30, 1, true),
  ('haircolor_red', 'hair_color', '빨강 머리', '불꽃 같은 빨강.', 'haircolor.red', 40, 1, true),
  ('haircolor_pink', 'hair_color', '분홍 머리', '벚꽃 같은 분홍.', 'haircolor.pink', 60, 1, true),
  ('haircolor_mint', 'hair_color', '민트 머리', '시원한 민트.', 'haircolor.mint', 60, 2, true),
  ('haircolor_purple', 'hair_color', '보라 머리', '신비로운 보라.', 'haircolor.purple', 80, 2, true),
  ('haircolor_silver', 'hair_color', '은발', '반짝이는 은빛.', 'haircolor.silver', 100, 3, true)
ON CONFLICT ("code") DO NOTHING;
