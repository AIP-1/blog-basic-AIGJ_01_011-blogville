import { expect, test } from "./fixtures";
import { signUpOk, sql, writePost } from "./helpers";

// 블로그 꾸미기: 강조색
test("블로그 관리에서 강조색을 파랑으로 바꾸면 내 블로그 홈·글·방명록의 버튼 색이 바뀌고, 다른 블로그는 그대로", async ({ page }) => {
  const me = await signUpOk(page);
  const postId = await writePost(page, "색 바꾸기", "본문");

  await page.goto("/settings/blog");
  const card = page.locator("#accent");
  await expect(card.getByRole("radio", { name: "초록" })).toBeChecked();
  await card.getByText("파랑").click();
  await card.getByRole("button", { name: "색 바꾸기" }).click();
  await expect(card.getByRole("status")).toBeVisible();
  await expect(card.getByRole("radio", { name: "파랑" })).toBeChecked();
  expect((await sql`select b.accent_color from blogs b join users u on u.id = b.owner_id where u.username = ${me}`)[0].accent_color).toBe("blue");

  for (const path of [`/@${me}`, `/@${me}/${postId}`, `/@${me}/guestbook`]) {
    await page.goto(path);
    const accent = await page.locator("[data-blog-accent]").first().evaluate((el) => getComputedStyle(el).getPropertyValue("--accent").trim());
    expect(accent, path).toBe("#1f5fa8");
  }
  // 헤더(블로그 밖)의 [글쓰기]는 사이트 기본 초록
  await expect(page.locator("header").getByRole("link", { name: /글쓰기/ })).toHaveCSS("background-color", "rgb(42, 115, 72)");

  // 다시 초록으로 고르면 NULL (기본)
  await page.goto("/settings/blog");
  await page.locator("#accent").getByText("초록").click();
  await page.locator("#accent").getByRole("button", { name: "색 바꾸기" }).click();
  await expect(page.locator("#accent").getByRole("status")).toBeVisible();
  expect((await sql`select b.accent_color from blogs b join users u on u.id = b.owner_id where u.username = ${me}`)[0].accent_color).toBeNull();
  await page.goto(`/@${me}`);
  await expect(page.locator("[data-blog-accent]")).toHaveCount(0);
});

test("목록에 없는 색은 DB가 받지 않는다", async () => {
  await expect(sql`update blogs set accent_color = 'red' where id = (select min(id) from blogs)`).rejects.toThrow();
});
