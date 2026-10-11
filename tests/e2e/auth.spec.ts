import { expect, test } from "@playwright/test";
import { PASSWORD, signIn, signUp, signUpOk, sql, uid } from "./helpers";

test.describe("US1 가입·로그인·로그아웃", () => {
  test("가입하면 블로그·프로필·카테고리 '일상'이 함께 생기고 내 블로그로 간다", async ({ page }) => {
    const name = uid("Tt");
    await signUp(page, `  ${name} `);
    const username = name.toLowerCase();
    await expect(page).toHaveURL(new RegExp(`/@${username}\\?welcome=1$`));
    await expect(page.getByText("Blogville에 오신 걸 환영해요!")).toBeVisible();
    await expect(page.getByRole("heading", { name: `${username}의 블로그` })).toBeVisible();

    const [row] = await sql`
      select u.role, p.nickname, b.slug, b.title, b.intro, a.password,
        (select array_agg(name) from categories c where c.blog_id = b.id) as cats
      from users u join profiles p on p.user_id = u.id join blogs b on b.owner_id = u.id
      join accounts a on a.user_id = u.id where u.username = ${username}`;
    expect(row).toMatchObject({ role: "user", nickname: username, slug: username, title: `${username}의 블로그`, intro: "", cats: ["일상"] });
    expect(row.password).not.toContain(PASSWORD); // 해시로만 저장 (NF-09)
  });

  test("블로그 이름 칸은 아이디를 따라가다가 고치면 멈추고, 비우면 다시 따라간다", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "회원가입" }).click();
    const title = page.getByLabel("블로그 이름");
    await page.getByLabel("아이디").fill("abcd");
    await expect(title).toHaveValue("abcd의 블로그");
    await title.fill("나의 작은 정원");
    await page.getByLabel("아이디").fill("abcde");
    await expect(title).toHaveValue("나의 작은 정원");
    await title.fill("");
    await expect(title).toHaveValue("abcde의 블로그");
  });

  test("형식 오류: 문구 하나, 아이디·블로그 이름은 남고 비밀번호는 비운다", async ({ page }) => {
    await signUp(page, uid(), { password: "short", blogTitle: "내 블로그" });
    await expect(page.locator("p[role=alert]")).toHaveText("비밀번호는 8자 이상이에요");
    await expect(page.getByLabel("블로그 이름")).toHaveValue("내 블로그");
    await expect(page.getByLabel("비밀번호", { exact: true })).toHaveValue("");

    await page.getByLabel("아이디").fill("admin");
    await page.getByLabel("비밀번호", { exact: true }).fill(PASSWORD);
    await page.getByLabel("비밀번호 확인").fill(PASSWORD);
    await page.getByRole("button", { name: "회원가입" }).click();
    await expect(page.locator("p[role=alert]")).toHaveText("이 아이디는 쓸 수 없어요");
  });

  test("대소문자만 다른 아이디, 남의 블로그 주소·닉네임과 같은 아이디는 거부", async ({ browser }) => {
    const first = await browser.newPage();
    const username = await signUpOk(first);

    const second = await browser.newPage();
    await signUp(second, username.toUpperCase());
    await expect(second.locator("p[role=alert]")).toHaveText("이미 있는 아이디예요");

    // 첫 회원이 블로그 주소를 바꾸면, 그 새 주소도 다른 사람의 아이디로 쓸 수 없다
    const slug = uid("s");
    await first.goto("/settings/blog");
    await first.getByLabel("블로그 주소").fill(slug);
    await first.getByRole("button", { name: "주소 바꾸기" }).click();
    await expect(first.getByRole("status")).toHaveText("저장했어요 ✓");
    await signUp(second, slug);
    await expect(second.locator("p[role=alert]")).toHaveText("이미 있는 아이디예요");
  });

  test("같은 아이디로 동시에 가입하면 회원은 1명만 생긴다", async ({ browser }) => {
    const username = uid();
    const pages = await Promise.all([browser.newPage(), browser.newPage()]);
    await Promise.all(pages.map((p) => signUp(p, username)));
    // 한쪽은 내 블로그로, 다른 쪽은 "이미 있는 아이디예요"
    await Promise.all(
      pages.map((p) => expect(p.locator("p[role=alert]").or(p.getByText("Blogville에 오신 걸 환영해요!"))).toBeVisible()),
    );
    const [{ n }] = await sql`select count(*)::int as n from users where username = ${username}`;
    expect(n).toBe(1);
  });

  test("로그아웃하면 첫 화면, 로그인하면 내 블로그. 아이디는 대소문자·공백 무시", async ({ page }) => {
    const username = await signUpOk(page);
    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL("/");
    await page.goto("/write");
    await expect(page).toHaveURL("/");

    await signIn(page, ` ${username.toUpperCase()} `);
    await expect(page).toHaveURL(`/@${username}`);
  });

  test("로그인 실패 문구는 하나, 5번 틀리면 6번째는 맞는 비밀번호도 잠금", async ({ page }) => {
    const username = await signUpOk(page);
    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL("/");

    await signIn(page, "", "");
    await expect(page.locator("p[role=alert]")).toHaveText("아이디와 비밀번호를 적어 주세요");
    await signIn(page, uid("x"), "wrongpass");
    await expect(page.locator("p[role=alert]")).toHaveText("아이디 또는 비밀번호가 맞지 않아요");

    for (let i = 0; i < 5; i++) {
      await signIn(page, username, "wrongpass");
      await expect(page.locator("p[role=alert]")).toHaveText("아이디 또는 비밀번호가 맞지 않아요");
    }
    await signIn(page, username, PASSWORD);
    await expect(page.locator("p[role=alert]")).toHaveText("로그인을 너무 많이 시도했어요. 5분 뒤에 다시 시도해 주세요");

    // 5분이 지나면 풀린다
    await sql`update login_attempts set locked_until = now() - interval '1 second' where username = ${username}`;
    await signIn(page, username, PASSWORD);
    await expect(page).toHaveURL(`/@${username}`);
  });

  test("유지 안 함은 세션 쿠키 + 2시간, 유지는 7일 쿠키", async ({ page, context }) => {
    const username = await signUpOk(page);
    const session = async () => (await context.cookies()).find((c) => c.name.endsWith("better-auth.session_token"))!;
    expect((await session()).expires).toBe(-1);
    const [short] = await sql`select remember_me, extract(epoch from expires_at - now()) as left from sessions s join users u on u.id = s.user_id where u.username = ${username}`;
    expect(short.remember_me).toBe(false);
    expect(Number(short.left)).toBeLessThan(2 * 3600 + 60);

    // 마지막 사용 2시간이 지나면 로그아웃된다
    await sql`update sessions set updated_at = now() - interval '2 hours 1 minute' where user_id = (select id from users where username = ${username})`;
    await page.goto("/write");
    await expect(page).toHaveURL("/");

    await signIn(page, username, PASSWORD, true);
    await expect(page).toHaveURL(`/@${username}`);
    const days = ((await session()).expires * 1000 - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
  });

  test("라이브러리 HTTP 인증 경로는 404 (NF-12)", async ({ request }) => {
    for (const path of ["/api/auth/sign-up/email", "/api/auth/sign-in/username", "/api/auth/sign-out"]) {
      expect((await request.post(path, { data: {} })).status()).toBe(404);
    }
  });
});
