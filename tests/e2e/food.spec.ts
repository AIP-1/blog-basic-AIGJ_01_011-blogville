import { expect, test } from "./fixtures";

// 🍽 맛집: 카카오(KAKAO_REST_API_KEY)나 네이버(NAVER_SEARCH_CLIENT_*) 열쇠가 하나라도 있을 때 켜진다. 시험 환경에는 열쇠가 없다.
// 식당·후기를 고르는 규칙은 tests/unit/food.test.ts
test("열쇠가 없으면 상단 메뉴에 맛집이 없고 /food는 준비 중 안내만 보인다", async ({ page }) => {
  await page.goto("/food?tab=region&region=광주");
  await expect(page.getByRole("heading", { name: "🍽 맛집" })).toBeVisible();
  await expect(page.getByText("맛집 기능을 준비하고 있어요")).toBeVisible();
  await expect(page.locator("[data-food-place]")).toHaveCount(0);
  await expect(page.locator('[data-main-nav] a[href="/food"]')).toHaveCount(0);
});
