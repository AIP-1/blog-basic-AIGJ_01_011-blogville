import { expect, test } from "./fixtures";

// 업데이트 소식 (/updates): GitHub 릴리스 노트. 네트워크가 막히면 안내 문구가 나온다
test.describe("업데이트 소식", () => {
  test("아래 링크로 들어가 릴리스(또는 안내)를 보고, 375px에서 가로 스크롤이 없다", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    await page.locator("[data-updates-link]").click();
    await expect(page).toHaveURL(/\/updates$/);
    await expect(page.getByRole("heading", { level: 1, name: "🆕 업데이트 소식" })).toBeVisible();
    await expect(page.locator("[data-release], [data-updates-error]").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
