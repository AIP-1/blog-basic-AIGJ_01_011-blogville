import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, signIn, signUpOk, sql, writePost } from "./helpers";

// 블로그 관리 방문자 카드(BLOG-06)·카테고리 글 수(BLOG-05), 비밀번호 바꾸기·헤더 내 정보, specs/015-settings-visits-password
test.describe.configure({ timeout: 60_000 });

const blogIdOf = async (username: string) =>
  (await sql`select b.id from blogs b join users u on u.id = b.owner_id where u.username = ${username}`)[0].id as number;
const hashOf = async (username: string) =>
  (await sql`select a.password from accounts a join users u on u.id = a.user_id where u.username = ${username} and a.provider_id = 'credential'`)[0]
    .password as string;

test.describe("BLOG-06 블로그 관리 방문자 카드", () => {
  test("오늘·어제·전체와 최근 7일 막대, 마지막 칸은 오늘, 375px 가로 스크롤 없음", async ({ page, browser }) => {
    const owner = await signUpOk(page);
    const blogId = await blogIdOf(owner);
    const [{ today }] = await sql`select (now() at time zone 'Asia/Seoul')::date::text as today`;
    await sql`insert into blog_visits (blog_id, date, visitor_id)
      select ${blogId}, ${today}::date - d, gen_random_uuid() from unnest(array[0, 0, 1, 3, 10]) as d`;

    await page.goto("/settings/blog");
    const card = page.locator("#visits");
    await expect(card.getByRole("heading", { name: "👣 방문자" })).toBeVisible();
    await expect(card.locator("[data-visit-summary]")).toHaveText("오늘 2 · 어제 1 · 전체 5");
    const days = card.getByRole("list", { name: "최근 7일 방문자" }).getByRole("listitem");
    await expect(days).toHaveCount(7);
    await expect(days.last()).toHaveAttribute("aria-label", "오늘 방문 2");
    await expect(days.last()).toHaveAttribute("data-day", today);
    await expect(days.nth(5)).toHaveAttribute("aria-label", /^\d+\/\d+ 방문 1$/);
    await expect(days.nth(4)).toHaveAttribute("aria-label", /^\d+\/\d+ 방문 0$/);
    await expect(days.nth(3)).toHaveAttribute("aria-label", /^\d+\/\d+ 방문 1$/);
    await expect(days.first()).toHaveAttribute("aria-label", /^\d+\/\d+ 방문 0$/); // 10일 전은 7칸 밖

    const phone = await browser.newContext({ viewport: { width: 375, height: 800 } });
    const p = await phone.newPage();
    await signIn(p, owner);
    await expect(p).toHaveURL(new RegExp(`/@${owner}$`));
    await p.goto("/settings/blog");
    await expect(p.locator("#visits [data-day]")).toHaveCount(7);
    expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await phone.close();
  });

  test("카테고리 줄마다 글 수(비공개 포함, 대분류는 소분류 글도)", async ({ page }) => {
    const row = (name: string) =>
      page.locator("div").filter({ has: page.getByText(name, { exact: true }) }).filter({ has: page.getByRole("button", { name: "이름 바꾸기" }) }).last();
    await signUpOk(page);
    await page.goto("/settings/blog");
    await page.getByLabel("새 카테고리 이름").fill("여행");
    await page.getByLabel("새 카테고리 이름").press("Enter");
    await expect(row("여행")).toBeVisible();
    await row("여행").getByRole("button", { name: "소분류 추가" }).click();
    await page.getByLabel("소분류 이름").fill("제주");
    await page.getByLabel("소분류 이름").press("Enter");
    await expect(row("제주")).toBeVisible();

    await writePost(page, "대분류 글", "본문", { category: "여행" });
    await writePost(page, "소분류 비밀 글", "본문", { category: "여행", sub: "제주", private: true });
    await page.goto("/settings/blog");
    await expect(row("여행").locator("[data-post-count]")).toHaveText("(2)");
    await expect(row("제주").locator("[data-post-count]")).toHaveText("(1)");
  });
});

test.describe("비밀번호 바꾸기", () => {
  const form = (page: Page) => page.getByRole("region", { name: "비밀번호 바꾸기" });
  const fill = async (page: Page, current: string, next: string, confirm = next) => {
    await form(page).getByLabel("지금 비밀번호").fill(current);
    await form(page).getByLabel("새 비밀번호 (8~64자)").fill(next);
    await form(page).getByLabel("새 비밀번호 확인").fill(confirm);
    await form(page).getByRole("button", { name: "비밀번호 바꾸기" }).click();
  };

  test("헤더 내 정보로 가서 바꾸면 새 비밀번호로만 들어가고 다른 기기의 로그인은 끊긴다", async ({ page, browser }) => {
    const username = await signUpOk(page);
    const other = await browser.newPage();
    await signIn(other, username);
    await expect(other).toHaveURL(new RegExp(`/@${username}$`));

    await page.getByRole("link", { name: "내 정보", exact: true }).click();
    await expect(page).toHaveURL(/\/settings\/account$/);
    await fill(page, PASSWORD, "newpass123");
    await expect(form(page).getByRole("status")).toHaveText("비밀번호를 바꿨어요");
    await expect(form(page).getByLabel("지금 비밀번호")).toHaveValue("");

    // 이 브라우저는 그대로, 다른 기기는 끊긴다
    await page.goto("/write");
    await expect(page).toHaveURL(/\/write$/);
    await other.goto("/write");
    await expect(other).toHaveURL(/\/$/);

    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL(/\/$/);
    await signIn(page, username);
    await expect(page.getByText("아이디 또는 비밀번호가 맞지 않아요")).toBeVisible();
    await signIn(page, username, "newpass123");
    await expect(page).toHaveURL(new RegExp(`/@${username}$`));
  });

  test("틀린 지금 비밀번호·짧은 새 비밀번호·확인 다름·같은 값은 문구만, 해시는 그대로", async ({ page }) => {
    const username = await signUpOk(page);
    const before = await hashOf(username);
    await page.goto("/settings/account");
    await fill(page, "wrongpass1", "newpass123");
    await expect(form(page).getByRole("alert")).toHaveText("지금 비밀번호가 맞지 않아요");
    await fill(page, PASSWORD, "short12");
    await expect(form(page).getByRole("alert")).toHaveText("비밀번호는 8자 이상이에요");
    await fill(page, PASSWORD, "newpass123", "newpass124");
    await expect(form(page).getByRole("alert")).toHaveText("비밀번호가 서로 달라요");
    await fill(page, PASSWORD, PASSWORD);
    await expect(form(page).getByRole("alert")).toHaveText("지금과 다른 비밀번호를 적어 주세요");
    await fill(page, "", "");
    await expect(form(page).getByRole("alert")).toHaveText("지금 비밀번호와 새 비밀번호를 적어 주세요");
    expect(await hashOf(username)).toBe(before);
  });

  test("방문자 헤더에는 로그인 링크, 회원 헤더 내 정보는 375px에서 아이콘만·44px", async ({ page, browser }) => {
    const visitor = await browser.newPage();
    await visitor.goto("/feed");
    await visitor.getByRole("navigation", { name: "메뉴" }).getByRole("link", { name: "로그인" }).click();
    await expect(visitor).toHaveURL(/\/$/);

    const phone = await browser.newContext({ viewport: { width: 375, height: 800 } });
    const p = await phone.newPage();
    await signUpOk(p);
    const link = p.getByRole("navigation", { name: "메뉴" }).getByRole("link", { name: "내 정보", exact: true });
    await expect(link).toBeVisible();
    await expect(link.getByText("내 정보")).toBeHidden();
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await phone.close();
    await page.close();
  });
});
