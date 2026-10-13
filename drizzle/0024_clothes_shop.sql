-- 옷가게 (SHOP-08, specs/051-clothes-shop): 새 옷 6벌·모자 3개. 상점에도 나오고, 옷가게에서 거울로 미리 입어 보고 한 번에 산다
INSERT INTO "items" ("code", "type", "name", "description", "art", "price", "required_level", "is_on_sale") VALUES
  ('hat_chef', 'hat', '요리사 모자', '높다란 하얀 요리사 모자.', 'hat.chef', 70, 2, true),
  ('hat_wizard', 'hat', '마법사 모자', '별이 반짝이는 뾰족 모자.', 'hat.wizard', 120, 4, true),
  ('hat_crown', 'hat', '금관', '마을에서 제일 빛나는 금관.', 'hat.crown', 500, 6, true),
  ('clothes_pajama', 'clothes', '줄무늬 잠옷', '파랑 줄무늬 포근한 잠옷.', 'clothes.pajama', 90, 1, true),
  ('clothes_chef', 'clothes', '요리사 옷', '단추 두 줄 하얀 요리사 옷.', 'clothes.chef', 140, 2, true),
  ('clothes_suit', 'clothes', '정장', '빨간 넥타이를 맨 까만 정장.', 'clothes.suit', 160, 2, true),
  ('clothes_hanbok', 'clothes', '색동 한복', '소매에 무지개 색동을 단 한복.', 'clothes.hanbok', 220, 3, true),
  ('clothes_robe', 'clothes', '마법사 로브', '별무늬 보랏빛 로브.', 'clothes.robe', 300, 4, true),
  ('clothes_armor', 'clothes', '기사 갑옷', '번쩍이는 은빛 갑옷.', 'clothes.armor', 400, 5, true)
ON CONFLICT ("code") DO NOTHING;
