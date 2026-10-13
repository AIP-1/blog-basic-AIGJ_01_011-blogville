import { expect, test, type Browser, type Page } from "./fixtures";
import { signUpOk, sql, uid } from "./helpers";

// 내 집 지붕 색 (TOWN-07), specs/041-roof-color
test.describe.configure({ timeout: 90_000 });

const HEX: Record<string, string> = { red: "#d9534f", orange: "#f0883e", yellow: "#f4d03f", green: "#5cb85c", sky: "#6ec6f0", blue: "#4a6fd9", purple: "#9b59b6", brown: "#8d6e63", pink: "#e67e9a", mint: "#1abc9c" };
const userId = async (username: string) => (await sql`select id from users where username = ${username}`)[0].id as string;
const saved = async (username: string) => (await sql`select roof_color from blogs where slug = ${username}`)[0].roof_color as string | null;
const picker = (page: Page) => page.locator("[data-roof-picker]");
const open = (page: Page) => picker(page).locator("[data-roof]");
/** 900 경험치를 더해 Lv.10(집 2단계)으로 */
const levelTen = (id: string) => sql`insert into point_ledger (user_id, reason, exp_delta, coin_delta, ref_id) values (${id}, 'post', 890, 0, ${uid("seed")})`;

async function member(browser: Browser) {
  const page = await browser.newPage();
  const username = await signUpOk(page);
  return { page, username, id: await userId(username) };
}

async function townRoofs(page: Page) {
  await page.goto("/town");
  const canvas = page.locator("[data-town] canvas");
  await expect(canvas).toHaveAttribute("data-ready", "1");
  return Object.fromEntries((await canvas.getAttribute("data-roofs"))!.split(" ").map((p) => p.split(":")));
}

test.describe("TOWN-07 지붕 색", () => {
  test("주인만 [🏠 지붕 색], 1단계는 처음 색 하나만 열리고 9색은 Lv과 함께 잠겨 있다", async ({ browser }) => {
    const { page, username } = await member(browser);
    await page.goto(`/@${username}`);
    await page.getByRole("button", { name: "🏠 지붕 색" }).click();
    await expect(picker(page)).toContainText("광장에 보일 지붕 색을 골라 주세요");
    await expect(picker(page)).toContainText("(1/10색)");
    await expect(open(page)).toHaveCount(1);
    await expect(open(page)).toHaveAttribute("aria-pressed", "true");
    await expect(open(page)).toHaveText("✓");
    const first = (await open(page).getAttribute("data-roof"))!;
    await expect(picker(page).locator("[data-roof-preview]")).toHaveAttribute("data-roof-preview", first);
    const locked = picker(page).locator("[data-roof-locked]");
    await expect(locked).toHaveCount(9);
    await expect(locked.first()).toHaveAccessibleName("잠긴 색, Lv.10에 열려요");
    await expect(locked.last()).toHaveAccessibleName("잠긴 색, Lv.90에 열려요");
    expect(await saved(username)).toBeNull();
    // 저장하지 않아도 마을에서는 처음 색
    expect((await townRoofs(page))["0"]).toBe(HEX[first]);
    await page.goto(`/@${username}`);
    await page.getByRole("button", { name: "🏠 지붕 색" }).click();
    await page.getByRole("button", { name: "✓ 다 골랐어요" }).click();
    await expect(picker(page)).toHaveCount(0);

    const visitor = await browser.newPage();
    await visitor.goto(`/@${username}`);
    await expect(visitor.locator("[data-house]")).toBeVisible();
    await expect(visitor.getByRole("button", { name: "🏠 지붕 색" })).toHaveCount(0);
    await visitor.close();
    await page.close();
  });

  test("Lv.10이면 두 번째 색이 열리고, 고르면 저장되어 내 마을과 나를 즐겨찾는 이웃의 마을에서 그 지붕", async ({ browser }) => {
    const owner = await member(browser);
    await levelTen(owner.id);
    await owner.page.goto(`/@${owner.username}`);
    await owner.page.getByRole("button", { name: "🏠 지붕 색" }).click();
    await expect(picker(owner.page)).toContainText("(2/10색)");
    await expect(open(owner.page)).toHaveCount(2);
    const second = (await open(owner.page).nth(1).getAttribute("data-roof"))!;
    await open(owner.page).nth(1).click();
    await expect(open(owner.page).nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(open(owner.page).nth(0)).toHaveAttribute("aria-pressed", "false");
    await expect(picker(owner.page).locator("[data-roof-preview]")).toHaveAttribute("data-roof-preview", second);
    expect(await saved(owner.username)).toBe(second);
    expect((await townRoofs(owner.page))["0"]).toBe(HEX[second]);

    const friend = await member(browser);
    await sql`insert into follows (follower_id, followee_id, is_favorite) values (${friend.id}, ${owner.id}, true)`;
    expect((await townRoofs(friend.page))["1"]).toBe(HEX[second]);
    await friend.page.close();
    await owner.page.close();
  });

  test("요청을 조작해도: 목록에 없는 색·잠긴 색은 문구와 함께 저장되지 않고, DB도 이상한 값을 거부한다", async ({ browser }) => {
    const { page, username, id } = await member(browser);
    await levelTen(id);
    await page.goto(`/@${username}`);
    await page.getByRole("button", { name: "🏠 지붕 색" }).click();
    const openCodes = await open(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-roof")!));
    const lockedCode = Object.keys(HEX).find((c) => !openCodes.includes(c))!;
    const cases: [string, string][] = [
      [`["gold"]`, "고를 수 없는 색이에요."],
      [`[3]`, "고를 수 없는 색이에요."],
      [`["${lockedCode}"]`, "아직 열리지 않은 색이에요. 집이 한 단계 클 때마다 색이 하나씩 늘어요."],
    ];
    for (const [body, message] of cases) {
      await page.route("**/*", async (route) => {
        const req = route.request();
        if (req.method() !== "POST" || req.headers()["next-action"] === undefined) return route.continue();
        await route.continue({ postData: body });
      });
      const done = page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined);
      await open(page).nth(1).click();
      expect((await done).status()).toBe(200);
      await expect(page.locator("[data-house]").getByRole("alert")).toHaveText(message);
      await page.unrouteAll();
    }
    expect(await saved(username)).toBeNull();
    await expect(sql`update blogs set roof_color = 'gold' where slug = ${username}`).rejects.toThrow();
    await page.close();
  });
});
