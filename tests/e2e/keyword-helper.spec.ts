import { expect, test } from "@playwright/test";
import { signUpOk } from "./helpers";

// 🔎 키워드 도우미는 네이버 열쇠가 있을 때만 보인다 (시험 서버엔 열쇠가 없다). 비교·요약 규칙은 tests/unit/keyword-trend.test.ts
test("열쇠가 없으면 글쓰기 화면에 키워드 도우미가 없다", async ({ page }) => {
  await signUpOk(page);
  await page.goto("/write");
  await expect(page.getByLabel("태그")).toBeVisible();
  await expect(page.locator("[data-keyword-helper]")).toHaveCount(0);
});

test("열쇠가 없으면 블로그 관리에 📊 내 태그 인기 흐름 카드가 없다", async ({ page }) => {
  await signUpOk(page);
  await page.goto("/settings/blog");
  await expect(page.locator("#widgets")).toBeVisible();
  await expect(page.locator("#tag-trend")).toHaveCount(0);
});
