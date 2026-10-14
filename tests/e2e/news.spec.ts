import { expect, test } from "./fixtures";
import { signUpOk } from "./helpers";

// 📰 뉴스 위젯: 네이버 검색 API 열쇠(NAVER_SEARCH_CLIENT_ID·_SECRET)가 있을 때만 켜진다. 시험 환경에는 열쇠가 없다.
// 이슈를 고르는 규칙은 tests/unit/news.test.ts
test("열쇠가 없으면 옆 칸에 뉴스 위젯이 없고 /api/news도 꺼져 있다, 이상한 탭은 400", async ({ page }) => {
  const me = await signUpOk(page);
  await page.goto(`/@${me}`);
  await expect(page.locator("[data-sidebar]")).toBeVisible();
  await expect(page.locator('[data-widget="news"]')).toHaveCount(0);
  expect((await page.request.get("/api/news?tab=all")).status()).toBe(404);
  expect((await page.request.get("/api/news?tab=../../x")).status()).toBe(400);
});
