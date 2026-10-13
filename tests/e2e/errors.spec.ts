import { expect, test, type Browser } from "./fixtures";
import { signUpOk, sql } from "./helpers";

// 서버 오류 기록 (⚠️ 오류): onRequestError → error_logs → 관리자 오류 화면
test.describe.configure({ timeout: 90_000 });

const TEST_ROUTE = "/admin/errors/test";

async function member(browser: Browser) {
  const page = await browser.newPage();
  const username = await signUpOk(page);
  const [{ id }] = await sql`select id from users where username = ${username}`;
  return { page, username, userId: id as string };
}

async function admin(browser: Browser) {
  const m = await member(browser);
  await sql`update users set role = 'admin' where id = ${m.userId}`;
  return m;
}

const testErrors = () => sql`select id, count, message, url from error_logs where route_path = ${TEST_ROUTE} order by id`;

test("방문자·일반 회원은 오류 화면과 시험 오류가 404다", async ({ browser }) => {
  const visitor = await browser.newPage();
  const m = await member(browser);
  for (const p of [visitor, m.page]) {
    expect((await p.goto("/admin/errors"))!.status()).toBe(404);
    expect((await p.request.post(TEST_ROUTE)).status()).toBe(404);
  }
});

test("관리자가 시험 오류를 만들면 목록에 뜨고, 다시 만들면 횟수가 2, 해결함으로 지우면 관리 기록이 남는다", async ({ browser }) => {
  // 같은 오류는 1시간 안에 묶이므로 이전 실행의 시험 오류를 먼저 치운다
  await sql`delete from error_logs where route_path = ${TEST_ROUTE}`;
  const a = await admin(browser);
  await a.page.goto("/admin");
  await a.page.getByRole("navigation", { name: "관리자 메뉴" }).getByRole("link", { name: "⚠️ 오류" }).click();
  await expect(a.page).toHaveURL(/\/admin\/errors$/);

  const make = async () => {
    await a.page.getByRole("button", { name: "시험 오류 만들기" }).click();
    await expect(a.page.locator("[data-test-error-result]")).toHaveText("시험 오류를 만들었어요");
  };
  await make();
  await expect.poll(async () => (await testErrors()).map((r) => r.count)).toEqual([1]);
  const [row] = await testErrors();
  expect(row.message).toBe("시험 오류");
  expect(row.url).toBe(TEST_ROUTE);

  await a.page.reload();
  const item = a.page.locator(`[data-error-log="${row.id}"]`);
  await expect(item.locator("[data-error-message]")).toHaveText("시험 오류");
  await expect(item.locator("[data-error-times]")).toHaveText("1회");

  await make();
  await expect.poll(async () => (await testErrors()).map((r) => r.count)).toEqual([2]);
  await a.page.reload();
  await expect(item.locator("[data-error-times]")).toHaveText("2회");
  await expect(item.locator("pre")).toBeHidden();
  await item.locator("summary").click();
  await expect(item.locator("pre")).toContainText("시험 오류");

  // 대시보드: 최근 24시간 오류 (적어도 방금 2번)
  await a.page.goto("/admin");
  const recent = Number(await a.page.locator("[data-errors-recent]").getAttribute("data-errors-recent"));
  expect(recent).toBeGreaterThanOrEqual(2);
  await expect(a.page.locator("[data-errors-recent]")).toHaveText(`⚠️ 최근 24시간 오류 ${recent.toLocaleString("ko-KR")}건`);

  await a.page.goto("/admin/errors?range=7d");
  a.page.once("dialog", (d) => d.accept());
  await item.getByRole("button", { name: "해결함" }).click();
  await expect(item).toHaveCount(0);
  expect(await testErrors()).toHaveLength(0);
  const audit = await sql`select detail from admin_audit where action = 'resolve_error' and target_id = ${String(row.id)} and admin_id = ${a.userId}`;
  expect(audit).toHaveLength(1);
  expect(audit[0].detail).toBe(`${TEST_ROUTE} · 2회`);
});
