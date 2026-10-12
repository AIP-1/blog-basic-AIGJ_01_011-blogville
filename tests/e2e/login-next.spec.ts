import { expect, test, type Browser, type Page } from "./fixtures";
import { PASSWORD, signUpOk, sql } from "./helpers";

// 로그인 뒤 보던 글로 돌아오기 (AUTH-09·SOC-01·SOC-03 열린 질문), specs/021-login-next
test.describe.configure({ timeout: 60_000 });

/** 가입해 두고 로그아웃한 회원 (방문자로 글을 보다가 로그인한다) */
async function signedOut(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const username = await signUpOk(page);
  await context.clearCookies();
  return { page, username };
}

/** 다른 시험의 최신 글 목록을 건드리지 않게 아주 옛 날짜의 공개 글을 넣는다 */
async function oldPost(username: string, title: string, html = "<p>본문</p>") {
  const [{ id }] = await sql`insert into posts (blog_id, title, content_html, content_text, is_public, created_at)
    select b.id, ${title}, ${html}, '본문', true, '2001-01-01' from blogs b join users u on u.id = b.owner_id
    where u.username = ${username} returning posts.id`;
  return id as number;
}

/** 지금 화면(첫 화면)의 로그인 폼으로 로그인 */
async function logIn(page: Page, username: string, password = PASSWORD) {
  await page.getByLabel("아이디").fill(username);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
}

const comments = (page: Page) => page.locator("#comments");
const menu = (page: Page) => page.getByRole("navigation", { name: "메뉴" });
const hint = (page: Page) => page.getByText("로그인하면 보던 화면으로 돌아가요");

test.describe("로그인 뒤 보던 글로", () => {
  test("댓글 칸의 [로그인]으로 로그인하면 그 글의 댓글 자리로 돌아온다 (틀린 비밀번호 뒤에도)", async ({ browser }) => {
    const owner = await signUpOk(await browser.newPage());
    // 본문이 길어 댓글 자리는 첫 화면 아래에 있다
    const id = await oldPost(owner, "돌아올 글", "<p>긴 본문</p>".repeat(60));
    const { page, username } = await signedOut(browser);

    await page.goto(`/@${owner}/${id}`);
    const login = comments(page).getByRole("link", { name: "로그인" });
    await expect(login).toHaveAttribute("href", `/?next=${encodeURIComponent(`/@${owner}/${id}#comments`)}`);
    expect((await login.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await login.click();
    await expect(page).toHaveURL(`/?next=${encodeURIComponent(`/@${owner}/${id}#comments`)}`);
    await expect(hint(page)).toBeVisible();

    await logIn(page, username, "wrongpass1");
    await expect(page.locator("p[role=alert]")).toHaveText("아이디 또는 비밀번호가 맞지 않아요");
    await logIn(page, username);
    await expect(page).toHaveURL(`/@${owner}/${id}#comments`);
    await expect(comments(page).getByRole("button", { name: "댓글 등록" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "💬 댓글 0" })).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(menu(page).getByRole("button", { name: "로그아웃" })).toBeVisible();
  });

  test("공감 안내의 [로그인]과 헤더 [로그인]도 보던 화면으로 돌아온다, 첫 화면에서는 돌아갈 곳이 없다", async ({ browser }) => {
    const owner = await signUpOk(await browser.newPage());
    const id = await oldPost(owner, "공감할 글");
    const { page, username } = await signedOut(browser);
    const postNext = `/?next=${encodeURIComponent(`/@${owner}/${id}`)}`;

    await page.goto(`/@${owner}/${id}`);
    await expect(page.locator("[data-like-login]")).toHaveText("로그인하면 공감할 수 있어요");
    await expect(page.getByRole("button", { name: /공감 0/ })).toHaveAccessibleDescription("로그인하면 공감할 수 있어요");
    const likeLogin = page.locator("[data-like-login]").getByRole("link", { name: "로그인" });
    await expect(likeLogin).toHaveAttribute("href", postNext);
    expect((await likeLogin.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(menu(page).getByRole("link", { name: "로그인" })).toHaveAttribute("href", postNext);

    // 다른 화면으로 옮기면 헤더 [로그인]도 따라 바뀐다
    await page.getByRole("link", { name: "목록으로" }).click();
    await expect(page).toHaveURL(`/@${owner}`);
    await expect(menu(page).getByRole("link", { name: "로그인" })).toHaveAttribute("href", `/?next=${encodeURIComponent(`/@${owner}`)}`);
    await page.goto("/feed");
    await expect(menu(page).getByRole("link", { name: "로그인" })).toHaveAttribute("href", `/?next=${encodeURIComponent("/feed")}`);
    await page.goto("/");
    await expect(menu(page).getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/");
    await expect(hint(page)).toHaveCount(0);

    await page.goto(`/@${owner}/${id}`);
    await page.locator("[data-like-login]").getByRole("link", { name: "로그인" }).click();
    await expect(page).toHaveURL(postNext);
    await logIn(page, username);
    await expect(page).toHaveURL(`/@${owner}/${id}`);
    await expect(page.getByRole("button", { name: /공감 0/ })).toBeEnabled();
  });

  test("다른 사이트 주소·점 경로·이상한 값·조작한 값이면 안내 없이 로그인 뒤 마을로", async ({ browser }) => {
    const owner = await signUpOk(await browser.newPage());
    const id = await oldPost(owner, "바로 갈 글");
    const { page, username } = await signedOut(browser);

    for (const next of ["//evil.com", "https://evil.com", "/\\evil.com", "/\t/evil.com", "javascript:alert(1)", "/..//evil.com", "/.//evil.com"]) {
      await page.goto(`/?next=${encodeURIComponent(next)}`);
      await expect(hint(page)).toHaveCount(0);
      await expect(page.locator('input[name="next"]')).toHaveCount(0);
    }
    await logIn(page, username);
    await expect(page).toHaveURL("/town");

    // 숨은 칸을 다른 사이트 주소로 바꿔 보내도 마을로 간다
    await page.context().clearCookies();
    await page.goto(`/?next=${encodeURIComponent(`/@${owner}/${id}`)}`);
    await page.locator('input[name="next"]').evaluate((el) => ((el as HTMLInputElement).value = "//evil.com"));
    await logIn(page, username);
    await expect(page).toHaveURL("/town");
  });

  test("로그인한 채 열면 바로 그 화면으로(다른 사이트·점 경로면 마을로), 돌아갈 주소 안에 다시 넣은 next도 걸러진다", async ({ browser }) => {
    const owner = await signUpOk(await browser.newPage());
    const id = await oldPost(owner, "바로 갈 글");
    const page = await browser.newPage();
    const username = await signUpOk(page);

    // 이미 로그인했으면 첫 화면을 거치지 않고 돌아갈 화면(다른 사이트면 마을)으로
    await page.goto(`/?next=${encodeURIComponent(`/@${owner}/${id}#comments`)}`);
    await expect(page).toHaveURL(`/@${owner}/${id}#comments`);
    for (const next of ["//evil.com", "/..//evil.com", "/%2e%2e//evil.com"]) {
      await page.goto(`/?next=${encodeURIComponent(next)}`);
      await expect(page).toHaveURL("/town");
    }

    // 돌아갈 주소 안에 다시 넣은 next도 결국 걸러진다
    await page.context().clearCookies();
    await page.goto(`/?next=${encodeURIComponent("/?next=/..//evil.com")}`);
    await logIn(page, username);
    await expect(page).toHaveURL("/town");
  });

  test("가입은 지금처럼 환영 카드가 있는 내 블로그로 간다", async ({ browser }) => {
    const owner = await signUpOk(await browser.newPage());
    const id = await oldPost(owner, "가입할 글");
    const page = await browser.newPage();
    await page.goto(`/@${owner}/${id}`);
    await comments(page).getByRole("link", { name: "로그인" }).click();
    await expect(hint(page)).toBeVisible();
    // signUpOk가 첫 화면을 다시 열지 않도록 직접 가입한다
    await page.getByRole("tab", { name: "회원가입" }).click();
    const username = `n${Date.now().toString(36)}`.slice(0, 20);
    await page.getByLabel("아이디").fill(username);
    await page.getByLabel("비밀번호", { exact: true }).fill(PASSWORD);
    await page.getByLabel("비밀번호 확인").fill(PASSWORD);
    await page.getByRole("button", { name: "회원가입" }).click();
    await expect(page).toHaveURL(`/@${username}?welcome=1`);
  });
});
