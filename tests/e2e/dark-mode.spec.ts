import { expect, test } from "./fixtures";
import { signUpOk } from "./helpers";

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

/** 앞 칸에서 Tab으로 들어와 키보드 초점(:focus-visible)을 그 요소에 둔다 */
async function tabInto(page: import("./fixtures").Page, target: import("./fixtures").Locator) {
  await target.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(target).toBeFocused();
}

test("어두운 화면: PC 광장의 종이·나무는 캔버스 이름표처럼 늘 밝은 값, 건물 안 화면은 어둡게 따라가고 나무 간판 초점은 크림색", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signUpOk(page);
  await page.emulateMedia({ colorScheme: "dark" });

  // PC 광장: 지갑 칩(종이)·☰ 간판(나무)·입구 말풍선이 밝은 종이 그대로 (사이트 테마가 아니라 마을 하늘을 따른다)
  await page.goto("/town?sky=night");
  const wallet = page.locator("[data-town-wallet]");
  await expect(wallet).toHaveCSS("background-color", "rgb(251, 241, 220)");
  await expect(wallet).toHaveCSS("color", "rgb(59, 42, 32)");
  await expect(page.locator("[data-town-prompt]")).toHaveCSS("background-color", "rgb(251, 241, 220)");
  const plank = page.locator("[data-town-menu]").locator("xpath=..");
  await expect(plank).toHaveCSS("background-color", "rgb(138, 90, 52)");
  // 캔버스 위 종이 조작의 초점은 먹 테 + 종이 띠 두 겹 (낮·밤 풀 어디서나 한쪽이 3:1 이상)
  await tabInto(page, wallet);
  await expect(wallet).toHaveCSS("outline-color", "rgb(59, 42, 32)");
  await expect(wallet).toHaveCSS("outline-offset", "5px");
  expect(await wallet.evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(251, 241, 220) 0px 0px 0px 5px");
  // 간판 속 ☰ 메뉴는 간판 안쪽 크림 테
  const menu = page.locator("[data-town-menu]");
  await tabInto(page, menu);
  await expect(menu).toHaveCSS("outline-color", "rgb(251, 241, 220)");
  await expect(menu).toHaveCSS("outline-offset", "-6px");

  // 건물 안 화면: 나무 간판은 어두운 나무, 간판 속 [🚪 광장으로] 초점은 크림색 (남색 종이색이면 1.4:1로 안 보인다)
  await page.goto("/shop");
  await expect(page.locator(".px-sign")).toHaveCSS("background-color", "rgb(90, 58, 36)");
  await expect(page.locator(".px-room")).toHaveCSS("background-color", "rgb(38, 42, 64)");
  const exit = page.locator(".px-sign").getByRole("link", { name: "🚪 광장으로" });
  await tabInto(page, exit);
  await expect(exit).toHaveCSS("outline-color", "rgb(243, 230, 200)");
});
