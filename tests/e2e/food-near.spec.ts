import { expect, test } from "./fixtures";

// 🍽 내 주변 거리(300m~2km)·분류(식당·카페/디저트·술집), 식당 후기 거르기·쪽 넘기기.
// 카카오·네이버 열쇠가 없는 시험 서버에서는 건너뛴다. 분류·거르기 규칙은 tests/unit/food-kind.test.ts
test("거리·분류 단추로 주소가 바뀌고 고른 것만 보인다", async ({ page }) => {
  await page.goto("/food?tab=near&lat=35.147&lng=126.915");
  const filters = page.locator("[data-near-filters]");
  test.skip((await filters.count()) === 0, "열쇠가 없는 시험 서버");
  await expect(filters.locator('[data-chip="r-500"]')).toHaveAttribute("aria-current", "page");
  await filters.locator('[data-chip="r-2000"]').click();
  await expect(page).toHaveURL(/r=2000/);
  await filters.locator('[data-chip="kind-cafe"]').click();
  await expect(page).toHaveURL(/r=2000&kind=cafe/);
  await expect(page.locator("[data-near-count]")).toContainText("2km 안 카페·디저트");
  // 거리를 바꿔도 분류는 그대로
  await filters.locator('[data-chip="r-300"]').click();
  await expect(page).toHaveURL(/r=300&kind=cafe/);
});

test("식당 후기는 그 식당 이야기만 남기고 뺀 글 수를 알려 주며, 10편씩 쪽을 넘긴다", async ({ page }) => {
  await page.goto("/food?tab=search&q=%EB%A7%88%ED%94%BC%EC%95%84&place=1000");
  const count = page.locator("[data-review-count]");
  test.skip((await count.count()) === 0, "열쇠가 없는 시험 서버");
  await expect(count).toContainText("그 식당 이야기로 보이는 글");
  const pages = page.locator("[data-review-pages] a");
  if ((await pages.count()) > 1) {
    await pages.nth(1).click();
    await expect(page).toHaveURL(/rp=2/);
    await expect(page.locator("[data-review-pages] a[aria-current=page]")).toHaveText("2");
  }
});
