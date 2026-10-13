import { expect, test } from "./fixtures";
import { png } from "./files";
import { signUpOk, sql } from "./helpers";

// 블로그 꾸미기: 커버 사진. 올리면 블로그 홈 맨 위에 보이고 방문자도 볼 수 있고, 지우면 사라지고 사진은 다시 주인만 볼 수 있다
test("커버 사진을 올리면 블로그 홈 맨 위에 보이고, 지우면 사라진다", async ({ page, browser }) => {
  const me = await signUpOk(page);
  const stored = async () => (await sql`select b.cover_key from blogs b join users u on u.id = b.owner_id where u.username = ${me}`)[0].cover_key as string | null;

  await page.goto(`/@${me}`);
  await expect(page.locator("[data-blog-cover]")).toHaveCount(0);

  await page.goto("/settings/blog");
  const card = page.locator("#cover");
  await card.getByLabel(/커버 사진 고르기/).setInputFiles(png("커버.png", 1600, 400));
  await expect(card.getByRole("status")).toHaveText("커버 사진을 바꿨어요");
  const key = await stored();
  expect(key).toMatch(/^[0-9a-f]{32}$/);
  await expect(card.locator("[data-cover-preview]")).toHaveAttribute("src", `/files/${key}?w=640`);

  await page.goto(`/@${me}`);
  await expect(page.locator("[data-blog-cover]")).toHaveAttribute("src", `/files/${key}?w=1280`);

  // 방문자도 커버 사진을 본다
  const visitor = await browser.newPage();
  await visitor.goto(`/@${me}`);
  await expect(visitor.locator("[data-blog-cover]")).toBeVisible();
  const res = await visitor.request.get(`/files/${key}?w=1280`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/webp");

  // 지우기 (확인 창)
  await page.goto("/settings/blog");
  page.once("dialog", (d) => void d.accept());
  await card.getByRole("button", { name: "커버 지우기" }).click();
  await expect(card.getByRole("status")).toHaveText("커버 사진을 지웠어요");
  expect(await stored()).toBeNull();
  await page.goto(`/@${me}`);
  await expect(page.locator("[data-blog-cover]")).toHaveCount(0);
  expect((await visitor.request.get(`/files/${key}`)).status()).toBe(404);
});
