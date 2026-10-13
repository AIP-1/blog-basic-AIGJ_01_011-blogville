import { execFileSync } from "node:child_process";
import { expect, test, type BrowserContext } from "./fixtures";
import { PASSWORD, signIn, signUpOk, sql, uid } from "./helpers";

// [로그인 상태 유지] 7일 연장(SessionKeeper)·남은 dont_remember 쿠키·만료 세션과 실패 기록 정리 (AUTH-09, NF-26), specs/027-session-keep
test.describe.configure({ timeout: 90_000 });

const cookie = async (context: BrowserContext, name: string) => (await context.cookies()).find((c) => c.name.endsWith(`better-auth.${name}`));
const daysLeft = (expires: number) => (expires * 1000 - Date.now()) / 86_400_000;
const sessionRows = (username: string) =>
  sql`select s.id, s.remember_me, extract(epoch from s.expires_at - now()) / 86400 as days from sessions s join users u on u.id = s.user_id where u.username = ${username}`;

test.describe("AUTH-09 로그인 유지 연장", () => {
  test("유지 안 함으로 쓰던 브라우저에서 유지로 로그인하면 dont_remember가 지워지고, 쓰는 동안 세션·쿠키가 다시 7일이 된다 (10분에 한 번)", async ({ page, context }) => {
    const username = await signUpOk(page);
    expect(await cookie(context, "dont_remember")).toBeTruthy();
    // 유지 안 함 세션은 연장 요청을 보내지 않는다
    const keeps: string[] = [];
    page.on("request", (r) => {
      if (new URL(r.url()).pathname === "/api/auth/get-session") keeps.push(r.url());
    });
    await page.goto(`/@${username}`);
    await expect(page.getByRole("link", { name: "내 정보" })).toBeVisible();
    await page.waitForTimeout(500);
    expect(keeps).toHaveLength(0);

    await sql`update sessions set updated_at = now() - interval '3 hours' where user_id = (select id from users where username = ${username})`;
    const firstKeep = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/auth/get-session");
    await signIn(page, username, PASSWORD, true);
    await expect(page).toHaveURL("/town");
    expect(await cookie(context, "dont_remember")).toBeUndefined();
    const [row] = await sessionRows(username);
    expect(row.remember_me).toBe(true);
    // 로그인할 때 바로 한 번 묻는다 (아직 늘릴 때가 아니어도)
    // (이 응답이 끝난 뒤에 DB를 바꿔야 그 요청이 아래 값을 덮지 않는다)
    expect((await firstKeep).status()).toBe(200);
    expect(keeps).toHaveLength(1);

    // 5일 남은 세션처럼 만들고(1시간 넘게 지난 갱신), 쿠키도 하루 남은 것으로 바꾼다
    await sql`update sessions set expires_at = now() + interval '5 days', updated_at = now() - interval '2 days' where id = ${row.id}`;
    const token = (await cookie(context, "session_token"))!;
    await context.addCookies([{ ...token, expires: Math.floor(Date.now() / 1000) + 86_400 }]);
    expect(daysLeft((await cookie(context, "session_token"))!.expires)).toBeLessThan(1.1);

    // 10분 안에는 다시 묻지 않는다. 서버가 화면을 그릴 때는 늘리지 않는다 (쿠키를 못 바꾸므로 DB만 늘면 연장이 사라진다)
    await page.reload();
    // 마을에는 헤더가 없어 ☰ 메뉴로 화면이 다 그려졌는지 본다 (039)
    await expect(page.locator("[data-town-menu]")).toBeVisible();
    await page.waitForTimeout(500);
    expect(keeps).toHaveLength(1);
    expect(Number((await sessionRows(username))[0].days)).toBeLessThan(5.1);

    // 10분이 지나 화면을 열면 묻고, 라이브러리가 세션과 쿠키를 다시 7일로 늘린다
    await page.evaluate(() => localStorage.setItem("bv_session_kept_at", String(Date.now() - 11 * 60 * 1000)));
    const answered = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/auth/get-session");
    await page.reload();
    expect((await answered).status()).toBe(200);
    expect(keeps).toHaveLength(2);
    await expect.poll(async () => daysLeft((await cookie(context, "session_token"))!.expires)).toBeGreaterThan(6.9);
    const [after] = await sessionRows(username);
    expect(Number(after.days)).toBeGreaterThan(6.9);
    // 세션 쿠키는 브라우저를 닫아도 남는 쿠키 그대로이고, 다른 화면도 로그인된 채다
    expect((await cookie(context, "session_token"))!.expires).toBeGreaterThan(0);
    await page.goto("/write");
    await expect(page).toHaveURL("/write");
  });
});

test.describe("NF-26 정리 작업", () => {
  test("만료 세션과 잠기지 않은 하루 지난 로그인 실패 기록만 지우고, 살아 있는 세션·잠금·최근 기록은 남긴다", async ({ page }) => {
    const username = await signUpOk(page);
    const [{ id: userId }] = await sql`select id from users where username = ${username}`;
    const dead = uid("dead");
    await sql`insert into sessions (id, token, user_id, expires_at, created_at, updated_at)
      values (${dead}, ${dead}, ${userId}, now() - interval '1 minute', now() - interval '3 days', now() - interval '3 days')`;
    // 유지 안 함인데 마지막 사용이 2시간 넘게 지난 세션 (만료 시각은 남아 있어도 이미 무효)
    const idle = uid("idle");
    await sql`insert into sessions (id, token, user_id, expires_at, remember_me, created_at, updated_at)
      values (${idle}, ${idle}, ${userId}, now() + interval '1 day', false, now() - interval '3 hours', now() - interval '3 hours')`;
    const [live] = await sql`select id from sessions where user_id = ${userId} and id not in (${dead}, ${idle})`;
    const [oldName, lockedName, freshName] = [uid("old"), uid("lock"), uid("new")];
    await sql`insert into login_attempts (username, failures, locked_until, updated_at) values
      (${oldName}, 3, null, now() - interval '25 hours'),
      (${lockedName}, 0, now() + interval '3 minutes', now() - interval '25 hours'),
      (${freshName}, 2, null, now() - interval '1 hour')`;

    const run = (...args: string[]) => execFileSync("npm", ["run", "-s", "posts:cleanup", "--", ...args], { encoding: "utf8" });
    expect(run("--dry-run")).toMatch(/지울 만료 세션: [1-9]\d*개/);
    expect(await sql`select 1 from sessions where id = ${dead}`).toHaveLength(1);
    const out = run();
    expect(out).toMatch(/지운 만료 세션: \d+개/);
    expect(out).toMatch(/지운 오래된 로그인 실패 기록: \d+줄/);

    expect(await sql`select 1 from sessions where id in (${dead}, ${idle})`).toHaveLength(0);
    expect(await sql`select 1 from sessions where id = ${live.id}`).toHaveLength(1);
    const left = (await sql`select username from login_attempts where username in (${oldName}, ${lockedName}, ${freshName}) order by 1`).map((r) => r.username);
    expect(left.sort()).toEqual([lockedName, freshName].sort());
    // 살아 있는 세션으로 계속 쓴다
    await page.goto("/write");
    await expect(page).toHaveURL("/write");
    await sql`delete from login_attempts where username in (${lockedName}, ${freshName})`;
  });
});
