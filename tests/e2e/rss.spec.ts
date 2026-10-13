import { expect, test } from "./fixtures";
import { signUpOk, writePost } from "./helpers";

// 구독·공유·검색 노출 (specs/054-rss-share): RSS, 공유 미리보기, sitemap·robots
test.describe.configure({ timeout: 90_000 });

test.describe("054 RSS·공유 미리보기", () => {
  test("RSS에는 공개 글만 최신순, 옆 칸에 구독 링크, 블로그 홈·글에 구독 주소와 미리보기", async ({ page, request }) => {
    const owner = await signUpOk(page);
    const first = await writePost(page, "첫 공개 글", "공개 본문 하나");
    await writePost(page, "숨긴 글", "비공개 본문", { private: true });
    const second = await writePost(page, "둘째 공개 글", "공개 본문 둘");

    const res = await request.get(`/@${owner}/rss`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/rss+xml");
    const xml = await res.text();
    expect(xml).toContain(`/@${owner}/${second}</link>`);
    expect(xml).toContain(`/@${owner}/${first}</link>`);
    expect(xml).not.toContain("숨긴 글");
    expect(xml.indexOf(`/@${owner}/${second}<`)).toBeLessThan(xml.indexOf(`/@${owner}/${first}<`));

    await page.goto(`/@${owner}`);
    await expect(page.locator("[data-rss]")).toHaveAttribute("href", `/@${owner}/rss`);
    await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute("href", new RegExp(`/@${owner}/rss$`));

    await page.goto(`/@${owner}/${second}`);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "둘째 공개 글");
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", "공개 본문 둘");
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
  });

  test("비공개 글은 주인이 봐도 미리보기를 내놓지 않고 검색엔진에 막는다, 없는 블로그 RSS는 404", async ({ page, request }) => {
    const owner = await signUpOk(page);
    const hidden = await writePost(page, "비밀 글", "비밀 본문", { private: true });
    await page.goto(`/@${owner}/${hidden}`);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    expect((await request.get("/@no_such_blog_zz/rss")).status()).toBe(404);
  });

  test("robots.txt는 sitemap을 알려 주고 회원 화면을 막는다, sitemap에 공개 글만", async ({ page, request }) => {
    const owner = await signUpOk(page);
    const shown = await writePost(page, "지도 글", "본문");
    const hidden = await writePost(page, "지도에 없는 글", "본문", { private: true });
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
    expect(robots).toContain("Disallow: /settings");
    const map = await (await request.get("/sitemap.xml")).text();
    expect(map).toContain(`/@${owner}/${shown}</loc>`);
    expect(map).not.toContain(`/@${owner}/${hidden}</loc>`);
  });
});
