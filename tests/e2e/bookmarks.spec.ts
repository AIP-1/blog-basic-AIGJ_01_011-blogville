import { expect, test, type Browser } from "./fixtures";
import { signUpOk, sql } from "./helpers";

// 🔖 스크랩 (나중에 읽기, specs/059-report-bookmarks)
test.describe.configure({ timeout: 90_000 });

async function member(browser: Browser) {
  const page = await browser.newPage();
  const username = await signUpOk(page);
  const [{ id }] = await sql`select id from users where username = ${username}`;
  return { page, username, userId: id as string };
}

async function insertPost(username: string, title: string, isPublic = true): Promise<number> {
  const [row] = await sql`insert into posts (blog_id, title, content_html, content_text, is_public)
    select b.id, ${title}, ${"<p>" + title + " 본문</p>"}, ${title + " 본문"}, ${isPublic} from blogs b join users u on u.id = b.owner_id where u.username = ${username}
    returning id`;
  return row.id as number;
}

const marks = (userId: string) => sql`select post_id from bookmarks where user_id = ${userId} order by post_id`;

test("공개 글을 스크랩하고 취소한다. 내 스크랩에 최신순으로 모이고 거기서도 지운다", async ({ browser }) => {
  const author = await member(browser);
  const reader = await member(browser);
  const first = await insertPost(author.username, "먼저 스크랩할 글");
  const second = await insertPost(author.username, "나중에 스크랩할 글");

  await reader.page.goto(`/@${author.username}/${first}`);
  const button = reader.page.locator("[data-bookmark]");
  await expect(button).toHaveText("🔖 스크랩 0");
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await button.click();
  await expect(button).toHaveText("🔖 스크랩함 1");
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => marks(reader.userId)).toEqual([{ post_id: first }]);
  // 다시 눌러 취소, 또 눌러 스크랩
  await button.click();
  await expect(button).toHaveText("🔖 스크랩 0");
  await expect.poll(() => marks(reader.userId)).toEqual([]);
  await button.click();
  await expect(button).toHaveText("🔖 스크랩함 1");
  await expect.poll(() => marks(reader.userId)).toHaveLength(1);
  await reader.page.reload();
  await expect(reader.page.locator("[data-bookmark]")).toHaveAttribute("aria-pressed", "true");

  await reader.page.goto(`/@${author.username}/${second}`);
  await reader.page.locator("[data-bookmark]").click();
  await expect(reader.page.locator("[data-bookmark]")).toHaveText("🔖 스크랩함 1");
  await expect.poll(() => marks(reader.userId)).toHaveLength(2);

  // 내 정보에서 들어간다
  await reader.page.goto("/settings/account");
  await reader.page.getByRole("link", { name: "🔖 내 스크랩" }).click();
  await expect(reader.page).toHaveURL(/\/bookmarks$/);
  await expect(reader.page.getByRole("heading", { name: "🔖 내 스크랩" })).toBeVisible();
  const items = reader.page.locator("[data-bookmark-item]");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("나중에 스크랩할 글");
  await expect(items.nth(1)).toContainText("먼저 스크랩할 글");
  await items.nth(0).getByRole("link", { name: /나중에 스크랩할 글/ }).click();
  await expect(reader.page).toHaveURL(new RegExp(`/@${author.username}/${second}$`));

  await reader.page.goto("/bookmarks");
  await reader.page.getByRole("button", { name: "'나중에 스크랩할 글' 스크랩 취소" }).click();
  await expect(reader.page.locator("[data-bookmark-item]")).toHaveCount(1);
  expect(await marks(reader.userId)).toEqual([{ post_id: first }]);
});

test("비공개가 된 글은 내 스크랩에서 빠지고, 남의 비공개 글은 조작해도 스크랩되지 않는다", async ({ browser }) => {
  const author = await member(browser);
  const reader = await member(browser);
  const postId = await insertPost(author.username, "곧 비공개가 될 글");
  const privateId = await insertPost(author.username, "처음부터 비공개 글", false);

  await reader.page.goto(`/@${author.username}/${postId}`);
  let captured: { url: string; headers: Record<string, string>; body: string } | null = null;
  reader.page.on("request", (req) => {
    if (req.method() === "POST" && req.headers()["next-action"] && req.postData() === `["${postId}"]`) captured = { url: req.url(), headers: req.headers(), body: req.postData()! };
  });
  await reader.page.locator("[data-bookmark]").click();
  await expect.poll(() => marks(reader.userId)).toEqual([{ post_id: postId }]);
  expect(captured).not.toBeNull();
  const { url, headers: sent } = captured!;
  const headers = Object.fromEntries(Object.entries(sent).filter(([k]) => k !== "cookie" && k !== "content-length"));

  await sql`update posts set is_public = false where id = ${postId}`;
  await reader.page.goto("/bookmarks");
  await expect(reader.page.locator("[data-bookmark-total]")).toHaveText("0개");
  await expect(reader.page.locator(`[data-bookmark-item="${postId}"]`)).toHaveCount(0);
  // 다시 공개되면 돌아온다
  await sql`update posts set is_public = true where id = ${postId}`;
  await reader.page.reload();
  await expect(reader.page.locator(`[data-bookmark-item="${postId}"]`)).toBeVisible();

  // 남의 비공개 글 ID로 조작한 요청, 방문자의 요청
  await reader.page.request.post(url, { headers, data: `["${privateId}"]` });
  const visitor = await browser.newPage();
  await visitor.request.post(url, { headers, data: `["${privateId}"]` });
  expect(await sql`select 1 from bookmarks where post_id = ${privateId}`).toHaveLength(0);
  // 비공개 글 화면에는 스크랩 버튼이 없다 (주인에게도)
  await author.page.goto(`/@${author.username}/${privateId}`);
  await expect(author.page.getByRole("heading", { name: "처음부터 비공개 글" })).toBeVisible();
  await expect(author.page.locator("[data-bookmark]")).toHaveCount(0);
});

test("방문자는 로그인 링크를 보고, 내 스크랩은 한 쪽에 10개씩", async ({ browser }) => {
  const author = await member(browser);
  const reader = await member(browser);
  const postId = await insertPost(author.username, "방문자가 보는 글");

  const visitor = await browser.newPage();
  await visitor.goto(`/@${author.username}/${postId}`);
  await expect(visitor.locator("[data-bookmark]")).toHaveCount(0);
  const login = visitor.locator("[data-bookmark-login]");
  await expect(login).toContainText("로그인하면 스크랩할 수 있어요");
  await expect(login.getByRole("link", { name: "로그인" })).toHaveAttribute("href", `/?next=${encodeURIComponent(`/@${author.username}/${postId}`)}`);
  await visitor.goto("/bookmarks");
  await expect(visitor.getByRole("link", { name: "로그인" }).last()).toHaveAttribute("href", `/?next=${encodeURIComponent("/bookmarks")}`);

  const ids: number[] = [];
  for (let i = 1; i <= 11; i++) ids.push(await insertPost(author.username, `스크랩 ${i}`));
  for (const [i, id] of ids.entries()) {
    await sql`insert into bookmarks (user_id, post_id, created_at) values (${reader.userId}, ${id}, now() - make_interval(mins => ${ids.length - i}))`;
  }
  await reader.page.goto("/bookmarks");
  await expect(reader.page.locator("[data-bookmark-item]")).toHaveCount(10);
  await expect(reader.page.locator("[data-bookmark-item]").first()).toContainText("스크랩 11");
  await reader.page.goto("/bookmarks?page=2");
  await expect(reader.page.locator("[data-bookmark-item]")).toHaveCount(1);
  await expect(reader.page.locator("[data-bookmark-item]").first()).toContainText("스크랩 1");
});
