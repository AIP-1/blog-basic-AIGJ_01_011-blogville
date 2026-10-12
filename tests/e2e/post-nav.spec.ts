import { expect, test, type Page } from "@playwright/test";
import { signUpOk, sql } from "./helpers";

// 글 상세 이전 글·다음 글, 블로그 이름 링크, 비공개 글 탭 제목 (POST-05, POST-03), specs/016-post-nav
test.describe.configure({ timeout: 60_000 });

/** 같은 시각(마이크로초까지)에 글을 차례로 넣고 [id] — 30일 전이라 다른 시험의 목록 첫 쪽에 끼지 않는다 */
async function insertSameTime(username: string, items: { title: string; isPublic?: boolean }[]) {
  const [blog] = await sql`select b.id from blogs b join users u on u.id = b.owner_id where u.username = ${username}`;
  const [{ at }] = await sql`select (now() - interval '30 days')::text as at`;
  const ids: number[] = [];
  for (const it of items) {
    const [row] = await sql`insert into posts (blog_id, title, content_html, content_text, is_public, created_at)
      values (${blog.id}, ${it.title}, '<p>본문</p>', '본문', ${it.isPublic ?? true}, ${at}::timestamptz) returning id`;
    ids.push(row.id);
  }
  return ids;
}

const nav = (page: Page) => page.getByRole("navigation", { name: "이전 글·다음 글" });
const older = (page: Page) => nav(page).locator('[data-adjacent="이전 글"]');
const newer = (page: Page) => nav(page).locator('[data-adjacent="다음 글"]');

test.describe("POST-05 이전 글·다음 글", () => {
  test("같은 시각 글도 바로 옆 글(자기 자신 아님), 끝 글엔 한쪽이 없고, 남에게는 비공개 글을 건너뛴다", async ({ page, browser }) => {
    const owner = await signUpOk(page);
    const [a, b, c, d] = await insertSameTime(owner, [{ title: "가 글" }, { title: "나 비밀 글", isPublic: false }, { title: "다 글" }, { title: "라 글" }]);

    const visitor = await browser.newPage();
    await visitor.goto(`/@${owner}/${c}`);
    await expect(older(visitor)).toHaveAttribute("href", `/@${owner}/${a}`);
    await expect(older(visitor)).toHaveText("이전 글가 글");
    await expect(newer(visitor)).toHaveAttribute("href", `/@${owner}/${d}`);
    await visitor.goto(`/@${owner}/${d}`);
    await expect(older(visitor)).toHaveAttribute("href", `/@${owner}/${c}`);
    await expect(newer(visitor)).toHaveCount(0);
    await visitor.goto(`/@${owner}/${a}`);
    await expect(older(visitor)).toHaveCount(0);
    await newer(visitor).click();
    await expect(visitor).toHaveURL(new RegExp(`/@${owner}/${c}$`));
    await expect(visitor.getByText("나 비밀 글")).toHaveCount(0);

    // 주인에게는 비공개 글도 이웃이고, 배지 없이 제목만
    await page.goto(`/@${owner}/${c}`);
    await expect(older(page)).toHaveAttribute("href", `/@${owner}/${b}`);
    await expect(older(page)).toHaveText("이전 글나 비밀 글");
    await page.goto(`/@${owner}/${a}`);
    await expect(newer(page)).toHaveAttribute("href", `/@${owner}/${b}`);
  });

  test("글이 하나뿐이면 칸이 없다", async ({ page }) => {
    const owner = await signUpOk(page);
    const [only] = await insertSameTime(owner, [{ title: "하나뿐인 글" }]);
    await page.goto(`/@${owner}/${only}`);
    await expect(page.getByRole("heading", { name: "하나뿐인 글" })).toBeVisible();
    await expect(nav(page)).toHaveCount(0);
  });

  test("375px에서 긴 제목은 한 줄로 줄이고 가로 스크롤 없음, 칸은 44px", async ({ page, browser }) => {
    const owner = await signUpOk(page);
    const long = "아주긴제목".repeat(19); // 95자, 제목은 100자까지
    const [, mid] = await insertSameTime(owner, [{ title: long }, { title: "가운데 글" }, { title: long + "!" }]);
    const phone = await browser.newContext({ viewport: { width: 375, height: 800 } });
    const p = await phone.newPage();
    await p.goto(`/@${owner}/${mid}`);
    await expect(older(p)).toBeVisible();
    for (const link of [older(p), newer(p)]) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await phone.close();
  });
});

test.describe("블로그 이름 링크·탭 제목", () => {
  test("글 상세 위 블로그 이름과 블로그 홈 제목은 /@주소로, 공개 글 탭은 글 제목 | 블로그 이름, 비공개 글은 주인에게도 글 | Blogville", async ({ page }) => {
    const owner = await signUpOk(page);
    const [{ title: blogTitle }] = await sql`select b.title from blogs b join users u on u.id = b.owner_id where u.username = ${owner}`;
    const [pub, priv] = await insertSameTime(owner, [{ title: "공개 글" }, { title: "숨긴 글", isPublic: false }]);

    await page.goto(`/@${owner}/${pub}`);
    await expect(page).toHaveTitle(`공개 글 | ${blogTitle}`);
    const blogLink = page.locator("article [data-blog-link]");
    await expect(blogLink).toHaveText(`📖 ${blogTitle}`);
    expect((await blogLink.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await blogLink.click();
    await expect(page).toHaveURL(new RegExp(`/@${owner}$`));

    await page.goto(`/@${owner}/${priv}`);
    await expect(page.getByRole("heading", { name: "숨긴 글" })).toBeVisible();
    await expect(page).toHaveTitle("글 | Blogville");

    await page.goto(`/@${owner}?s=${encodeURIComponent("공개")}`);
    await page.getByRole("heading", { level: 1 }).getByRole("link", { name: blogTitle }).click();
    await expect(page).toHaveURL(new RegExp(`/@${owner}$`));
  });
});
