import { expect, test, type Page } from "@playwright/test";
import { signUpOk, sql } from "./helpers";

// 마을 소식 1페이지 `🏡 블로그 둘러보기` (SOC-05 열린 질문의 제안), specs/025-blog-browse
test.describe.configure({ timeout: 60_000 });

const browse = (page: Page) => page.getByRole("region", { name: "🏡 블로그 둘러보기" });

/** 그 회원 블로그에 글을 넣는다. at: 지금부터 몇 분 뒤 */
async function postAt(username: string, title: string, minutes: number, isPublic = true) {
  await sql`insert into posts (blog_id, title, content_html, content_text, is_public, created_at)
    select b.id, ${title}, '<p>본문</p>', '본문', ${isPublic}, now() + make_interval(mins => ${minutes})
    from blogs b join users u on u.id = b.owner_id where u.username = ${username}`;
}

test.describe("SOC-05 블로그 둘러보기", () => {
  test("공개 글이 있는 블로그만 최근 공개 글 순으로, 공개 글 수, 누르면 블로그 홈, 2페이지·이웃 새 글에는 없다", async ({ page, browser }) => {
    const pages = await Promise.all([browser.newPage(), browser.newPage(), browser.newPage()]);
    const [a, b, hidden] = await Promise.all(pages.map((p) => signUpOk(p)));
    // 다른 시험이 쓰는 글보다 앞에 오도록 하루 가까이 뒤로 (마을 소식 시험의 하루 뒤 글보다는 뒤), 끝나면 옛 날짜로
    try {
      await postAt(b, "B의 글", 23 * 60);
      await postAt(a, "A의 옛 글", 23 * 60 - 30);
      await postAt(a, "A의 새 글", 23 * 60 + 10);
      await postAt(a, "A의 비밀 글", 23 * 60 + 20, false);
      await postAt(hidden, "비밀만 있는 블로그 글", 23 * 60 + 30, false);

      await page.goto("/feed");
      await expect(browse(page)).toBeVisible();
      const cells = browse(page).getByRole("listitem");
      expect(await cells.count()).toBeLessThanOrEqual(12);
      const slugs = await cells.evaluateAll((els) => els.map((el) => el.getAttribute("data-browse")));
      // A(최근 공개 글 +10분)가 B보다 앞, 비공개 글만 있는 블로그는 없다
      expect(slugs).toContain(a);
      expect(slugs).toContain(b);
      expect(slugs.indexOf(a)).toBeLessThan(slugs.indexOf(b));
      expect(slugs).not.toContain(hidden);
      // 글 수는 공개 글만
      const cellA = browse(page).locator(`[data-browse="${a}"]`);
      await expect(cellA).toContainText(`${a}의 블로그`);
      await expect(cellA).toContainText(`${a} · 글 2`);
      const link = cellA.getByRole("link");
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await link.click();
      await expect(page).toHaveURL(`/@${a}`);

      await page.goto("/feed?page=2");
      await expect(page.getByRole("heading", { name: "📋 마을 소식" })).toBeVisible();
      await expect(browse(page)).toHaveCount(0);
      await signUpOk(page);
      await page.goto("/feed/following");
      await expect(page.getByRole("heading", { name: "💛 이웃 새 글" })).toBeVisible();
      await expect(browse(page)).toHaveCount(0);

      // 375px에서 가로 스크롤 없이 두 칸씩
      const phone = await browser.newPage({ viewport: { width: 375, height: 800 } });
      await phone.goto("/feed");
      const first = (await browse(phone).getByRole("listitem").nth(0).boundingBox())!;
      const second = (await browse(phone).getByRole("listitem").nth(1).boundingBox())!;
      expect(second.y).toBeCloseTo(first.y, 0);
      expect(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    } finally {
      await sql`update posts set created_at = '2001-01-01' where blog_id in (
        select b.id from blogs b join users u on u.id = b.owner_id where u.username in ${sql([a, b, hidden])})`;
    }
  });
});
