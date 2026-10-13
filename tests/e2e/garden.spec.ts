import { expect, test, type Page } from "./fixtures";
import { signUpOk } from "./helpers";

// 내 정원 (TOWN-20)과 광장 옷가게·미용실 건물, specs/053-garden
test.describe.configure({ timeout: 90_000 });

const canvas = (page: Page) => page.locator("[data-town] canvas");
const prompt = (page: Page) => page.locator("[data-town-prompt]");
const feet = async (page: Page) => (await canvas(page).getAttribute("data-feet"))!.split(",").map(Number) as [number, number];
const teleport = (page: Page, x: number, y: number) =>
  canvas(page).evaluate((c, d) => c.dispatchEvent(new CustomEvent("bv-teleport", { detail: d })), { x, y });
async function openTown(page: Page) {
  await page.goto("/town");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
}
async function hold(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

test.describe("내 정원", () => {
  test("장미 아치 문으로 들어가고, 울타리는 막는다", async ({ page }) => {
    await signUpOk(page);
    await openTown(page);
    // 문 위에서 내려가면 정원 안으로 (집 지붕 앞까지)
    await teleport(page, 1000, 1000);
    await hold(page, "ArrowDown", 1200);
    expect((await feet(page))[1]).toBeGreaterThan(1100);
    // 울타리 위에서 내려가면 막힌다
    await teleport(page, 850, 1000);
    await hold(page, "ArrowDown", 1200);
    expect((await feet(page))[1]).toBeLessThanOrEqual(1042);
  });

  test("광장의 옷가게·미용실 건물: Space로 들어가고, 방문자는 로그인 안내", async ({ page, browser }) => {
    await signUpOk(page);
    await openTown(page);
    await teleport(page, 830, 570);
    await expect(prompt(page)).toHaveText("👗 옷가게 · Space 들어가기");
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(/\/clothes$/);
    await openTown(page);
    await teleport(page, 1230, 570);
    await expect(prompt(page)).toHaveText("💇 미용실 · Space 들어가기");
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(/\/salon$/);

    const guest = await browser.newPage();
    await openTown(guest);
    await teleport(guest, 1230, 570);
    await expect(prompt(guest)).toHaveText("💇 미용실 · Space 로그인하고 이용하기");
    await guest.close();
  });
});
