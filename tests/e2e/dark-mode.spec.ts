import { expect, test } from "./fixtures";

// 어두운 화면 (개선 8)
const bodyBg = (page: import("./fixtures").Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const DARK = "rgb(21, 23, 26)";
const LIGHT = "rgb(251, 250, 247)";

test("기기가 어두운 모드면 어둡게, 아래 막대 버튼으로 어둡게·밝게를 골라 다시 열어도 남는다", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  expect(await bodyBg(page)).toBe(DARK);

  const toggle = page.locator("[data-theme-toggle]");
  await expect(toggle).toHaveText("🖥️ 기기 설정");
  await toggle.click(); // 어둡게
  await expect(toggle).toHaveText("🌙 어둡게");
  await toggle.click(); // 밝게
  await expect(toggle).toHaveText("☀️ 밝게");
  expect(await bodyBg(page)).toBe(LIGHT);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await bodyBg(page)).toBe(LIGHT);

  await page.emulateMedia({ colorScheme: "light" });
  await page.locator("[data-theme-toggle]").click(); // 기기 설정
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  await page.locator("[data-theme-toggle]").click(); // 어둡게
  await page.goto("/@demo");
  expect(await bodyBg(page)).toBe(DARK);
});
