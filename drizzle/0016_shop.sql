ALTER TABLE "items" DROP CONSTRAINT "items_type_check";--> statement-breakpoint
ALTER TABLE "point_ledger" DROP CONSTRAINT "point_ledger_reason_check";--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "required_level" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "point_ledger_purchase_uq" ON "point_ledger" USING btree ("user_id","ref_id") WHERE "point_ledger"."reason" = 'purchase';--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_required_level_check" CHECK ("items"."required_level" between 1 and 99);--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_on_sale_check" CHECK (not "items"."is_on_sale" or ("items"."price" > 0 and not "items"."is_starter" and "items"."type" <> 'character'));--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_type_check" CHECK ("items"."type" in ('character', 'hat', 'clothes', 'accessory', 'furniture', 'background'));--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_purchase_check" CHECK (("point_ledger"."reason" = 'purchase') = ("point_ledger"."coin_delta" < 0) and ("point_ledger"."reason" <> 'purchase' or "point_ledger"."exp_delta" = 0));--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_reason_check" CHECK ("point_ledger"."reason" in ('signup', 'attendance', 'post', 'comment', 'like_received', 'purchase'));--> statement-breakpoint
-- 상점 아이템 (SHOP-01, 요구사항 4.6 "현재 아이템 목록"). 머리 모양·머리 색·옷가게·성장 아이템·광장 장식은 아직 없다
INSERT INTO "items" ("code", "type", "name", "description", "art", "price", "required_level", "is_on_sale") VALUES
  ('hat_straw', 'hat', '밀짚모자', '햇볕 좋은 날 산책할 때 딱이에요.', 'hat.straw', 50, 1, true),
  ('hat_ribbon', 'hat', '리본', '머리에 다는 커다란 빨간 리본.', 'hat.ribbon', 60, 1, true),
  ('hat_beanie', 'hat', '털모자', '귀까지 따뜻한 겨울 모자.', 'hat.beanie', 80, 2, true),
  ('clothes_overalls', 'clothes', '멜빵바지', '어디든 뛰어다니기 좋은 청 멜빵바지.', 'clothes.overalls', 100, 1, true),
  ('clothes_hoodie', 'clothes', '후드티', '포근한 초록 후드티.', 'clothes.hoodie', 150, 2, true),
  ('clothes_dress', 'clothes', '원피스', '노란 꽃무늬 원피스.', 'clothes.dress', 200, 3, true),
  ('acc_glasses', 'accessory', '안경', '글이 더 잘 보이는 동그란 안경.', 'acc.glasses', 70, 1, true),
  ('acc_scarf', 'accessory', '목도리', '빨간 줄무늬 목도리.', 'acc.scarf', 120, 2, true),
  ('acc_bag', 'accessory', '가방', '어깨에 메는 갈색 가방.', 'acc.bag', 180, 3, true),
  ('furn_table', 'furniture', '둥근 탁자', '차 한 잔 올려 두기 좋은 탁자.', 'furn.table', 40, 1, true),
  ('furn_rug', 'furniture', '알록달록 러그', '방이 환해지는 줄무늬 러그.', 'furn.rug', 50, 1, true),
  ('furn_shelf', 'furniture', '책장', '읽은 책을 가지런히.', 'furn.shelf', 80, 2, true),
  ('furn_lamp', 'furniture', '스탠드 조명', '밤에 글 쓸 때 켜는 조명.', 'furn.lamp', 60, 2, true),
  ('furn_bed', 'furniture', '포근한 침대', '푹 자고 일어나면 글이 잘 써져요.', 'furn.bed', 120, 3, true),
  ('furn_sofa', 'furniture', '푹신한 소파', '이웃이 놀러 오면 앉는 소파.', 'furn.sofa', 200, 4, true),
  ('bg_beach', 'background', '바닷가', '파도 소리가 들리는 모래사장.', 'bg.beach', 120, 1, true),
  ('bg_snow', 'background', '눈 마을', '소복소복 눈 쌓인 마을.', 'bg.snow', 200, 2, true),
  ('bg_blossom', 'background', '벚꽃길', '분홍 꽃잎이 날리는 길.', 'bg.blossom', 300, 3, true),
  ('bg_night', 'background', '밤의 도시', '별과 불빛이 반짝이는 밤.', 'bg.night', 450, 4, true),
  ('bg_space', 'background', '우주', '행성 사이를 떠다녀요.', 'bg.space', 900, 6, true);
