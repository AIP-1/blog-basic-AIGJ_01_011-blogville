import { expect, test } from "./fixtures";
import { signUpOk, writePost } from "./helpers";

// 통계 상세: 유입 경로·인기 글 (블로그 관리)
test("다른 사람이 네이버·블로그 안에서 글을 읽으면 블로그 관리에 출처와 인기 글이 보인다", async ({ page, browser }) => {
  const owner = await signUpOk(page);
  const id = await writePost(page, "인기 많은 글", "본문");

  await page.goto("/settings/blog");
  await expect(page.locator("#referrers")).toContainText("아직 기록이 없어요");
  await expect(page.locator("#popular")).toContainText("아직 읽힌 공개 글이 없어요");

  const fromNaver = await browser.newPage();
  await fromNaver.goto(`/@${owner}/${id}`, { referer: "https://search.naver.com/search.naver?query=%EB%B9%84%EB%B0%80" });
  await expect(fromNaver.getByLabel("조회 1")).toBeVisible();

  const inside = await browser.newPage();
  await inside.goto(`/@${owner}`);
  await inside.locator("article a").filter({ hasText: "인기 많은 글" }).first().click();
  await expect(inside).toHaveURL(`/@${owner}/${id}`);
  await expect(inside.getByLabel("조회 2")).toBeVisible();

  await page.goto("/settings/blog");
  const refs = page.locator("[data-referrers]");
  await expect(refs).toContainText("🟢 네이버");
  await expect(refs).toContainText("🏘 Blogville 안");
  await expect(refs).not.toContainText("비밀");
  await expect(page.locator("[data-popular-posts]")).toContainText("인기 많은 글");
  await expect(page.locator("[data-popular-posts]")).toContainText("👀 2");
});
