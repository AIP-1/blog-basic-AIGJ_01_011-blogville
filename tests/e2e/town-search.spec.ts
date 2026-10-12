import { expect, test, type Page } from "@playwright/test";
import { signUpOk, sql, uid } from "./helpers";

// 마을 검색 (BLOG-07), specs/013-town-search
test.describe.configure({ timeout: 60_000 });

const box = (page: Page) => page.getByRole("searchbox", { name: "검색어", exact: true });
const listTitle = (page: Page) => page.locator("#list-title");
const blogRows = (page: Page) => page.locator("[data-town-blog]");

/** 화면을 거치지 않고 글 하나를 넣는다 */
async function addPost(username: string, title: string, body: string, isPublic = true, minsAgo = 0) {
  const [blog] = await sql`select b.id from blogs b join users u on u.id = b.owner_id where u.username = ${username}`;
  await sql`insert into posts (blog_id, title, content_html, content_text, is_public, created_at)
    values (${blog.id}, ${title}, ${"<p>" + body + "</p>"}, ${body}, ${isPublic}, now() - make_interval(mins => ${minsAgo}))`;
}

test.describe("BLOG-07 마을 검색", () => {
  test("주인에게만 검색창이 있고, 남·방문자는 ?q=를 붙여도 보통 블로그 홈", async ({ page, browser }) => {
    const owner = await signUpOk(page);
    await expect(page.getByRole("heading", { name: "🏘 마을 검색" })).toBeVisible();
    await expect(box(page)).toHaveAttribute("maxlength", "50");
    await expect(box(page)).toHaveAttribute("placeholder", "마을의 글·블로그 검색");

    const m = await browser.newPage();
    await signUpOk(m);
    const v = await browser.newPage();
    for (const p of [m, v]) {
      await p.goto(`/@${owner}?q=본문`);
      await expect(listTitle(p)).toHaveText("전체 글 0개");
      await expect(p.getByRole("heading", { name: "🏘 마을 검색" })).toHaveCount(0);
      await expect(box(p)).toHaveCount(0);
    }
  });

  test("제목·본문으로 마을의 공개 글, 이름·닉네임으로 블로그를 찾는다. 비공개는 내 글이어도 없다", async ({ page, browser }) => {
    const key = `z${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`;
    const owner = await signUpOk(page);
    const other = await browser.newPage();
    const a = await signUpOk(other);
    const c = await signUpOk(await browser.newPage(), `c${key}`);
    await sql`update blogs set title = ${`${key} 정원`} where owner_id = (select id from users where username = ${a})`;
    await addPost(a, `제목에 ${key.toUpperCase()}`, "평범한 본문", true, 1);
    await addPost(owner, "내 공개 글", `본문 속 ${key} 이야기`, true, 2);
    await addPost(owner, `비밀 ${key}`, "숨김", false);
    await addPost(a, `남의 비밀 ${key}`, "숨김", false);

    await box(page).fill(`  ${key}  `);
    await box(page).press("Enter");
    await expect(page).toHaveURL(new RegExp(`/@${owner}\\?q=`));
    await expect(listTitle(page)).toHaveText(`🔍 '${key}' 검색 결과`);
    // 블로그: 최근 공개 글이 있는 a가 먼저, 글 없는 c가 뒤
    await expect(blogRows(page)).toHaveCount(2);
    await expect(blogRows(page).nth(0)).toHaveAttribute("data-town-blog", a);
    await expect(blogRows(page).nth(0)).toContainText(`${a} · ${key} 정원`);
    await expect(blogRows(page).nth(1)).toHaveAttribute("data-town-blog", c);
    await expect(blogRows(page).nth(1)).toContainText(`@${c}`);
    await expect(page.getByRole("heading", { name: "글 2개" })).toBeVisible();
    const list = page.locator("#town-posts").locator("..");
    await expect(list.getByRole("link", { name: `제목에 ${key.toUpperCase()}` })).toBeVisible();
    await expect(list.getByRole("link", { name: "내 공개 글" })).toBeVisible();
    await expect(list.getByText("비밀")).toHaveCount(0);
    await expect(box(page)).toHaveValue(key);
    // 검색 중에는 카테고리에 고른 항목이 없다
    await expect(page.getByRole("navigation", { name: "카테고리" }).locator("[aria-current]")).toHaveCount(0);

    await blogRows(page).nth(0).getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`/@${a}$`));
  });

  test("빈 검색어·결과 없음 문구, %와 _는 글자 그대로, 51자는 무시, 페이지를 넘겨도 검색어 유지", async ({ page }) => {
    const owner = await signUpOk(page);
    const key = `p${Date.now().toString(36).slice(-5)}`;
    await page.goto(`/@${owner}?q=%20%20`);
    await expect(page.getByText("검색어를 적어 주세요")).toBeVisible();
    await page.goto(`/@${owner}?q=${uid("none")}`);
    await expect(page.getByText("검색 결과가 없어요")).toBeVisible();
    await page.goto(`/@${owner}?q=${"가".repeat(51)}`);
    await expect(listTitle(page)).toHaveText("전체 글 0개");

    await addPost(owner, `${key} 100%`, "본문");
    await addPost(owner, `${key} 1000`, "본문");
    await addPost(owner, `${key} a_b`, "본문");
    await addPost(owner, `${key} axb`, "본문");
    await page.goto(`/@${owner}?q=${encodeURIComponent(`${key} 100%`)}`);
    await expect(page.getByRole("heading", { name: "글 1개" })).toBeVisible();
    await page.goto(`/@${owner}?q=${encodeURIComponent(`${key} a_b`)}`);
    await expect(page.getByRole("heading", { name: "글 1개" })).toBeVisible();

    for (let i = 1; i <= 9; i++) await addPost(owner, `${key} 쪽 ${i}`, "본문", true, 10 + i);
    await page.goto(`/@${owner}?q=${encodeURIComponent(`${key} 쪽`)}`);
    await expect(page.getByRole("heading", { name: "글 9개" })).toBeVisible();
    await page.getByRole("link", { name: "2", exact: true }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/q=/);
    await expect(listTitle(page)).toHaveText(`🔍 '${key} 쪽' 검색 결과`);
    await expect(page.getByRole("link", { name: `${key} 쪽 9` })).toBeVisible();
    await expect(blogRows(page)).toHaveCount(0); // 블로그 묶음은 1페이지에만

    await page.getByRole("link", { name: "← 전체 글 보기" }).click();
    await expect(page).toHaveURL(new RegExp(`/@${owner}$`));
    await expect(listTitle(page)).toHaveText(/^전체 글 \d+개$/);
  });

  test("375px에서 검색 결과에 가로 스크롤이 없다", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
    const page = await ctx.newPage();
    const owner = await signUpOk(page);
    await addPost(owner, `${owner} 아주 긴 제목 `.repeat(4), "본문");
    await page.goto(`/@${owner}?q=${owner}`);
    await expect(blogRows(page)).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await ctx.close();
  });
});
