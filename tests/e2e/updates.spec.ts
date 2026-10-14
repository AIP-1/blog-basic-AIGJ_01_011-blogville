import { expect, test } from "./fixtures";

// 업데이트 소식 (/updates): GitHub 릴리스 노트 목록과 버전별 화면. 네트워크가 막히면 안내 문구가 나온다
test.describe("업데이트 소식", () => {
  test("아래 링크로 들어가 목록(또는 안내)을 보고, 375px에서 가로 스크롤이 없다", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    await page.locator("[data-updates-link]").click();
    await expect(page).toHaveURL(/\/updates$/);
    await expect(page.getByRole("heading", { level: 1, name: "🆕 업데이트 소식" })).toBeVisible();
    await expect(page.locator("[data-release], [data-updates-error]").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("목록은 그림 없이 버전·날짜·요약, 누르면 버전 화면에 노트 전체와 이전 버전 링크", async ({ page }) => {
    await page.goto("/updates");
    const items = page.locator("ol[aria-label='릴리스 목록'] > li[data-release]");
    test.skip((await items.count()) === 0, "GitHub에 닿지 못하는 환경");
    await expect(page.locator("ol[aria-label='릴리스 목록'] img")).toHaveCount(0);
    await expect(items.first().locator("[data-release-latest]")).toBeVisible();
    const tag = await items.first().getAttribute("data-release");
    await items.first().getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`/updates/${tag!.replaceAll(".", "\\.")}$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(tag!.slice(1));
    await expect(page.locator(".release-body")).not.toBeEmpty();
    if ((await items.count()) > 1) await expect(page.locator("[data-release-older]")).toBeVisible();
    await page.getByRole("link", { name: "← 업데이트 소식 목록" }).click();
    await expect(page).toHaveURL(/\/updates$/);
  });

  test("없는 버전·이상한 주소는 404", async ({ page }) => {
    expect((await page.goto("/updates/v0.0.0"))!.status()).toBe(404);
    expect((await page.goto("/updates/latest"))!.status()).toBe(404);
  });
});
