import { expect, test } from "@playwright/test";
import { insertPosts, signUpOk } from "./helpers";

// 화면을 열 번 넘게 여는 시험이라 전체를 함께 돌리면 30초를 넘기곤 했다
test.describe.configure({ timeout: 60_000 });

test.describe("US3 블로그 홈 글 목록", () => {
  test("최신순 8개씩, 페이지 번호, 이상한 ?page는 1페이지", async ({ page, browser }) => {
    const username = await signUpOk(page);
    await insertPosts(username, 9);

    const visitor = await browser.newPage();
    await visitor.goto(`/@${username}`);
    const cards = visitor.getByRole("article");
    await expect(cards).toHaveCount(8);
    await expect(cards.first()).toContainText("글 9");
    await expect(visitor.getByRole("navigation", { name: "페이지" }).getByRole("link")).toHaveText(["1", "2"]);

    await visitor.getByRole("link", { name: "2", exact: true }).click();
    await expect(visitor).toHaveURL(`/@${username}?page=2`);
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("글 1");

    for (const bad of ["0", "-1", "abc", "2.5", "012", "1e1", "99999999999999999999"]) {
      await visitor.goto(`/@${username}?page=${bad}`);
      await expect(cards.first()).toContainText("글 9");
    }
  });

  test("빈 블로그: 방문자는 문구만, 주인은 [첫 글 쓰기]", async ({ page, browser }) => {
    const username = await signUpOk(page);
    await expect(page.getByRole("link", { name: "✏️ 첫 글 쓰기" })).toBeVisible();
    const visitor = await browser.newPage();
    await visitor.goto(`/@${username}`);
    await expect(visitor.getByText("아직 쓴 글이 없어요.")).toBeVisible();
    await expect(visitor.getByRole("link", { name: "✏️ 첫 글 쓰기" })).toHaveCount(0);
    await expect(visitor.getByRole("navigation", { name: "페이지" })).toHaveCount(0);
  });

  test("비공개 글은 남의 목록·글 수에서 빠진다", async ({ page, browser }) => {
    const username = await signUpOk(page);
    await insertPosts(username, 2);
    await insertPosts(username, 1, false);
    await page.goto(`/@${username}`);
    await expect(page.getByRole("article")).toHaveCount(3);
    const visitor = await browser.newPage();
    await visitor.goto(`/@${username}`);
    await expect(visitor.getByRole("article")).toHaveCount(2);
    await expect(visitor.getByRole("link", { name: /전체/ }).last()).toContainText("(2)");
  });
});
