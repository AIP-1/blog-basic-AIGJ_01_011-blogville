import { expect, test, type Page } from "@playwright/test";
import { signUpOk, sql } from "./helpers";

// 자동 출석 (GAME-04), specs/033-attendance
test.describe.configure({ timeout: 90_000 });

const today = sql`(now() at time zone 'Asia/Seoul')::date`;
const userId = async (username: string) => (await sql`select id from users where username = ${username}`)[0].id as string;
const rows = (id: string) => sql`select date::text, cycle_day, session_id from attendances where user_id = ${id} order by date`;
const ledger = (id: string) => sql`select exp_delta, coin_delta, ref_id from point_ledger where user_id = ${id} and reason = 'attendance' order by id`;

/** 오늘 출석을 지우고 어제(또는 n일 전) 출석을 n일차로 둔다 */
async function setLast(id: string, daysAgo: number, cycleDay: number) {
  await sql`delete from attendances where user_id = ${id}`;
  await sql`delete from point_ledger where user_id = ${id} and reason = 'attendance'`;
  await sql`insert into attendances (user_id, date, cycle_day) values (${id}, ${today} - ${daysAgo}::int, ${cycleDay})`;
}

const wallet = (page: Page) => page.locator("header [data-wallet]");

test.describe("GAME-04 출석", () => {
  test("가입하고 처음 연 화면에서 버튼 없이 1일차, 같은 날은 그대로, 출석 화면·보상표·달력, 375px", async ({ page }) => {
    const username = await signUpOk(page);
    const id = await userId(username);
    await expect(wallet(page)).toHaveText("Lv.1🪙 110");
    const [row] = await rows(id);
    expect(row.cycle_day).toBe(1);
    expect(row.session_id).not.toBeNull();
    const [day] = await sql`select ${today}::text as d`;
    expect(await ledger(id)).toEqual([{ exp_delta: 10, coin_delta: 10, ref_id: day.d }]);

    await page.goto("/feed");
    await page.goto("/wallet");
    expect(await rows(id)).toHaveLength(1);
    expect(await ledger(id)).toHaveLength(1);

    await page.getByRole("link", { name: "출석 체크" }).click();
    await expect(page).toHaveURL(/\/attendance$/);
    await expect(page.getByRole("heading", { name: "📮 출석 체크" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "출석 완료" })).toHaveText("출석 완료! 오늘 1일차");
    await expect(page.getByText("오늘 받은 보상 ✨ 10 · 🪙 10")).toBeVisible();
    await expect(page.getByRole("button", { name: /출석하기/ })).toHaveCount(0);
    const table = page.getByRole("list", { name: "보상표" }).getByRole("listitem");
    await expect(table).toHaveCount(7);
    await expect(table.nth(6)).toHaveText("7일차✨30🪙100");
    await expect(table.nth(0)).toHaveAttribute("aria-current", "step");
    await expect(page.locator("[data-month-summary]")).toHaveText("이번 달 1일 출석 · 현재 1일차");
    const todayCell = page.locator(`[data-day="${day.d}"]`);
    await expect(todayCell).toHaveText("🌟");
    await expect(todayCell).toHaveAttribute("aria-current", "date");

    await page.setViewportSize({ width: 375, height: 800 });
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    const tops = await table.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
  });

  test("일차: 어제 3일차 → 4, 어제 7일차 → 1, 그저께가 마지막 → 1. 보상은 표대로", async ({ page }) => {
    const username = await signUpOk(page);
    const id = await userId(username);
    for (const [daysAgo, last, expected, exp, coin] of [
      [1, 3, 4, 15, 40],
      [1, 6, 7, 30, 100],
      [1, 7, 1, 10, 10],
      [2, 5, 1, 10, 10],
    ]) {
      await setLast(id, daysAgo, last);
      await page.goto("/attendance");
      await expect(page.getByRole("status").filter({ hasText: "출석 완료" })).toHaveText(`출석 완료! 오늘 ${expected}일차`);
      const all = await rows(id);
      expect(all.at(-1)!.cycle_day).toBe(expected);
      expect((await ledger(id)).map((r) => [r.exp_delta, r.coin_delta])).toEqual([[exp, coin]]);
    }
  });

  test("탭 10개가 동시에 처음 열어도 출석 1행·원장 1줄, 세션이 지워져도 출석은 남고, 방문자는 첫 화면으로", async ({ page, browser }) => {
    const username = await signUpOk(page);
    const id = await userId(username);
    await sql`delete from attendances where user_id = ${id}`;
    await sql`delete from point_ledger where user_id = ${id} and reason = 'attendance'`;
    const statuses = await Promise.all(Array.from({ length: 10 }, () => page.request.get("/feed").then((r) => r.status())));
    expect(statuses.every((s) => s === 200)).toBe(true);
    expect(await rows(id)).toHaveLength(1);
    expect(await ledger(id)).toHaveLength(1);

    await sql`delete from sessions where user_id = ${id}`;
    const [after] = await rows(id);
    expect(after.session_id).toBeNull();

    const visitor = await browser.newPage();
    await visitor.goto("/attendance");
    await expect(visitor).toHaveURL(/\/(\?.*)?$/);
  });
});
