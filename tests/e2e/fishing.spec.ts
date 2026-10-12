import { expect, test } from "./fixtures";
import { signUpOk, sql } from "./helpers";

// 연못 낚시터 (TOWN-14), specs/046-fishing
test.describe.configure({ timeout: 90_000 });

const userId = async (username: string) => (await sql`select id from users where username = ${username}`)[0].id as string;

test.describe("TOWN-14 연못 낚시터", () => {
  test("하루 한 번 던지면 기록과 보상(코인 원장 또는 동물 먹이), 다시 열면 오늘 결과만, 지갑에 🎣 낚시", async ({ page }) => {
    const me = await signUpOk(page);
    const id = await userId(me);
    await page.goto("/fishing");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("🎣 연못 낚시터");
    await expect(page.getByText("연못에 낚싯대를 던져 볼까요?")).toBeVisible();
    await expect(page.locator("#fishing-catches + ul li")).toHaveCount(6);
    await page.getByRole("button", { name: "🎣 낚싯대 던지기" }).click();
    const pond = page.locator("[data-fishing]");
    await expect(pond).not.toHaveAttribute("data-fishing", "ready");
    await expect(pond).toContainText("내일 다시 낚시할 수 있어요.");
    const [log] = await sql`select catch, date::text from fishing_catches where user_id = ${id}`;
    const coins = await sql`select coin_delta, ref_id from point_ledger where user_id = ${id} and reason = 'fishing'`;
    const feed = await sql`select ui.quantity from user_items ui join items i on i.id = ui.item_id where ui.user_id = ${id} and i.code = 'growth_feed'`;
    if (log.catch === "feed") {
      expect(coins).toHaveLength(0);
      expect(feed).toEqual([{ quantity: 1 }]);
    } else {
      expect(coins).toHaveLength(1);
      expect(coins[0].ref_id).toBe(log.date);
      expect(feed).toHaveLength(0);
    }

    // 다시 열면 버튼 없이 오늘 결과, 최근 기록에 오늘
    await page.reload();
    await expect(page.getByRole("button", { name: "🎣 낚싯대 던지기" })).toHaveCount(0);
    await expect(pond).toContainText(/^.*오늘은 .+(을|를) 낚았어요\./);
    await expect(page.locator("[data-fishing-log] li")).toHaveCount(1);
    if (log.catch !== "feed") {
      await page.goto("/wallet");
      await expect(page.locator('[data-ledger="fishing"]').first()).toContainText("🎣 낚시");
    }
  });

  test("두 탭에서 동시에 던져도 기록은 하나, 나머지는 안내. 어제 낚았으면 오늘 다시", async ({ page, browser }) => {
    const me = await signUpOk(page);
    const id = await userId(me);
    await sql`insert into fishing_catches (user_id, date, catch) values (${id}, (now() at time zone 'Asia/Seoul')::date - 1, 'boot')`;
    const second = await browser.newContext({ storageState: await page.context().storageState() });
    const other = await second.newPage();
    await Promise.all([page.goto("/fishing"), other.goto("/fishing")]);
    await expect(page.locator("[data-fishing-log] li")).toHaveCount(1);
    await Promise.all([page.getByRole("button", { name: "🎣 낚싯대 던지기" }).click(), other.getByRole("button", { name: "🎣 낚싯대 던지기" }).click()]);
    await expect.poll(async () => (await sql`select 1 from fishing_catches where user_id = ${id}`).length).toBe(2);
    const alerts = [page, other].map((p) => p.getByRole("alert").filter({ hasText: "오늘은 이미 낚시했어요. 내일 다시 와 주세요!" }));
    await expect.poll(async () => (await alerts[0].count()) + (await alerts[1].count())).toBe(1);
    await second.close();
  });

  test("마을 낚시터: 입구에서 Space로 들어가고, 방문자는 /fishing에서 첫 화면으로", async ({ page, browser }) => {
    await signUpOk(page);
    await page.goto("/town");
    const canvas = page.locator("[data-town] canvas");
    await expect(canvas).toHaveAttribute("data-ready", "1");
    await canvas.evaluate((c) => c.dispatchEvent(new CustomEvent("bv-teleport", { detail: { x: 650, y: 790 } })));
    await expect(page.locator("[data-town-prompt]")).toHaveText("🎣 낚시터 · Space 들어가기");
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(/\/fishing$/);

    const guest = await browser.newPage();
    await guest.goto("/fishing");
    await expect(guest).toHaveURL(/\/$/);
    await guest.close();
  });
});
