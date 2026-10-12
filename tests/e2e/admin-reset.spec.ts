import { expect, test, type Page } from "./fixtures";
import { PASSWORD, signIn, signUpOk, sql } from "./helpers";

// 관리자 비밀번호 초기화 (AUTH-07 열린 질문, 비밀번호를 잊은 회원 복구), specs/029-admin-password-reset
test.describe.configure({ timeout: 90_000 });

async function makeAdmin(page: Page) {
  const username = await signUpOk(page);
  await sql`update users set role = 'admin' where username = ${username}`;
  return username;
}
const hashOf = async (username: string) =>
  (await sql`select a.password from accounts a join users u on u.id = a.user_id where u.username = ${username} and a.provider_id = 'credential'`)[0].password as string;

test.describe("AUTH-07 관리자 비밀번호 초기화", () => {
  test("아이디로 찾아 초기화하면 임시 비밀번호가 한 번 보이고, 회원의 로그인·실패 기록이 지워지며, 임시 비밀번호로 들어와 바꿀 수 있다", async ({ page, browser }) => {
    await makeAdmin(page);
    const member = await browser.newPage();
    const username = await signUpOk(member);
    await sql`insert into login_attempts (username, failures) values (${username}, 3) on conflict (username) do update set failures = 3`;

    await page.goto("/admin");
    // 대소문자·앞뒤 공백은 무시하고 정확히 같은 아이디만
    await page.getByLabel("찾을 아이디").fill(`  ${username.toUpperCase()} `);
    await page.getByRole("button", { name: "찾기" }).click();
    const card = page.locator(`[data-found-member="${username}"]`);
    await expect(card).toBeVisible();
    await expect(card).toContainText("회원");

    // 확인 창에서 취소하면 아무것도 바뀌지 않는다
    const before = await hashOf(username);
    page.once("dialog", (d) => d.dismiss());
    await card.getByRole("button", { name: "비밀번호 초기화" }).click();
    await page.waitForTimeout(500);
    expect(await hashOf(username)).toBe(before);

    page.once("dialog", (d) => {
      expect(d.message()).toContain(`${username} 회원의 비밀번호를 초기화할까요?`);
      d.accept();
    });
    await card.getByRole("button", { name: "비밀번호 초기화" }).click();
    const temp = page.locator("[data-temp-password]");
    await expect(temp).toHaveText(/^[A-Za-z2-9]{12}$/);
    const password = (await temp.textContent())!;
    expect(await hashOf(username)).not.toBe(before);
    expect(await hashOf(username)).not.toContain(password);
    expect(await sql`select 1 from sessions s join users u on u.id = s.user_id where u.username = ${username}`).toHaveLength(0);
    expect(await sql`select 1 from login_attempts where username = ${username}`).toHaveLength(0);
    // 관리자 자신의 로그인은 그대로
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "👑 관리자" })).toBeVisible();
    await expect(page.locator("[data-temp-password]")).toHaveCount(0);

    // 회원은 로그아웃됐고, 예전 비밀번호는 안 되고, 임시 비밀번호로 들어온다
    await member.goto("/write");
    await expect(member).toHaveURL("/");
    await signIn(member, username, PASSWORD);
    await expect(member.locator("p[role=alert]")).toHaveText("아이디 또는 비밀번호가 맞지 않아요");
    await signIn(member, username, password);
    await expect(member).toHaveURL(`/@${username}`);

    // 내 정보에서 새 비밀번호로 바꾼다
    await member.goto("/settings/account");
    const form = member.getByRole("region", { name: "비밀번호 바꾸기" });
    await form.getByLabel("지금 비밀번호").fill(password);
    await form.getByLabel("새 비밀번호 (8~64자)").fill("newpass123");
    await form.getByLabel("새 비밀번호 확인").fill("newpass123");
    await form.getByRole("button", { name: "비밀번호 바꾸기" }).click();
    await expect(form.getByRole("status")).toHaveText("비밀번호를 바꿨어요");
    const again = await browser.newPage();
    await signIn(again, username, "newpass123");
    await expect(again).toHaveURL(`/@${username}`);
  });

  test("없는 아이디·관리자는 초기화가 없고, 조작해도 관리자 계정은 거절, 일반 회원이 같은 요청을 보내면 404이고 그대로다", async ({ page, browser }) => {
    const admin = await makeAdmin(page);
    const member = await browser.newPage();
    const username = await signUpOk(member);
    const [{ id: adminId }] = await sql`select id from users where username = ${admin}`;

    await page.goto("/admin?member=nobody_such_id_x");
    await expect(page.getByText("그 아이디의 회원이 없어요")).toBeVisible();
    await page.goto(`/admin?member=${admin}`);
    await expect(page.locator(`[data-found-member="${admin}"]`)).toContainText("관리자의 비밀번호는 여기서 초기화할 수 없어요.");
    await expect(page.getByRole("button", { name: "비밀번호 초기화" })).toHaveCount(0);
    expect((await page.goto(`/admin?member=${"x".repeat(65)}`))!.status()).toBe(200);
    await expect(page.getByText("그 아이디의 회원이 없어요")).toHaveCount(0);

    // 회원 줄의 폼 값을 관리자 ID로 바꿔 보내면 거절
    await page.goto(`/admin?member=${username}`);
    const card = page.locator(`[data-found-member="${username}"]`);
    await card.locator('input[name="userId"]').evaluate((el, v) => ((el as HTMLInputElement).value = v), adminId as string);
    const adminHash = await hashOf(admin);
    page.once("dialog", (d) => d.accept());
    await card.getByRole("button", { name: "비밀번호 초기화" }).click();
    await expect(card.getByRole("alert")).toHaveText("관리자의 비밀번호는 초기화할 수 없어요.");
    expect(await hashOf(admin)).toBe(adminHash);

    // 진짜 요청을 붙잡아 일반 회원 쿠키로 다시 보낸다
    await page.goto(`/admin?member=${username}`);
    let captured: { url: string; headers: Record<string, string>; body: string } | null = null;
    await page.route("**/admin**", async (route) => {
      const req = route.request();
      if (req.method() === "POST" && req.headers()["next-action"]) {
        captured = { url: req.url(), headers: req.headers(), body: req.postData() ?? "" };
        await route.abort();
      } else await route.continue();
    });
    page.once("dialog", (d) => d.accept());
    await page.locator(`[data-found-member="${username}"]`).getByRole("button", { name: "비밀번호 초기화" }).click();
    await expect.poll(() => captured).not.toBeNull();
    const memberHash = await hashOf(username);
    const { url, headers, body } = captured!;
    const { cookie: _drop, ...rest } = headers;
    void _drop;
    const res = await member.request.post(url, { headers: rest, data: body });
    expect(res.status()).toBe(404);
    expect(await hashOf(username)).toBe(memberHash);
    expect(await sql`select 1 from sessions s join users u on u.id = s.user_id where u.username = ${username}`).not.toHaveLength(0);
    // 일반 회원에게 /admin은 404
    expect((await member.goto("/admin"))!.status()).toBe(404);
  });
});
