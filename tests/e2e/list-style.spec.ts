import { expect, test } from "./fixtures";
import { insertPosts, signUpOk, sql } from "./helpers";

// 블로그 꾸미기: 글 목록 모양
test("목록 모양을 목록형·앨범형으로 바꾸면 내 블로그 홈 글 목록이 바뀌고, 카드형으로 돌리면 DB 값이 비워진다", async ({ page }) => {
  const me = await signUpOk(page);
  await insertPosts(me, 3);
  const pick = async (label: string) => {
    await page.goto("/settings/blog");
    const card = page.locator("#list-style");
    await card.getByText(label, { exact: true }).click();
    await card.getByRole("button", { name: "모양 바꾸기" }).click();
    await expect(card.getByRole("status")).toBeVisible();
    await expect(card.getByRole("radio", { name: new RegExp(label) })).toBeChecked();
  };
  const stored = async () => (await sql`select b.list_style from blogs b join users u on u.id = b.owner_id where u.username = ${me}`)[0].list_style;

  await page.goto(`/@${me}`);
  await expect(page.locator("[data-list-style]")).toHaveCount(0);
  await expect(page.getByRole("article")).toHaveCount(3);

  await pick("목록형");
  expect(await stored()).toBe("list");
  await page.goto(`/@${me}`);
  await expect(page.locator('[data-list-style="list"] [data-post-row]')).toHaveCount(3);
  await expect(page.locator("[data-post-row]").first()).toContainText("글 3");
  await page.locator("[data-post-row]").first().click();
  await expect(page).toHaveURL(new RegExp(`/@${me}/\\d+$`));

  await pick("앨범형");
  expect(await stored()).toBe("gallery");
  await page.goto(`/@${me}`);
  await expect(page.locator('[data-list-style="gallery"] [data-post-tile]')).toHaveCount(3);

  await pick("카드형");
  expect(await stored()).toBeNull();
  await page.goto(`/@${me}`);
  await expect(page.getByRole("article")).toHaveCount(3);
});

test("목록에 없는 모양은 DB가 받지 않는다", async () => {
  await expect(sql`update blogs set list_style = 'table' where id = (select min(id) from blogs)`).rejects.toThrow();
});
