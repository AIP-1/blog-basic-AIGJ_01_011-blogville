import { expect, test, type Page } from "@playwright/test";
import { insertPosts, signUpOk, sql, writePost } from "./helpers";

// 이웃 (SOC-04)·마을 소식 (SOC-05), specs/008-neighbors
test.describe.configure({ timeout: 60_000 });

const followBtn = (page: Page) => page.getByRole("button", { name: /^(\+ 이웃 추가|✓ 이웃)$/ });
const followers = (page: Page) => page.locator("[data-followers]");
const userId = async (username: string) => (await sql`select id from users where username = ${username}`)[0].id as string;
const followRows = async (follower: string) =>
  (await sql`select 1 from follows f join users u on u.id = f.follower_id where u.username = ${follower}`).length;

test.describe("SOC-04 이웃", () => {
  test("추가하면 ✓ 이웃·이웃 1, 다시 누르면 취소, 버튼 44px 이상", async ({ page, browser }) => {
    const owner = await signUpOk(page);
    await expect(followers(page)).toHaveText("이웃 0");
    await expect(followBtn(page)).toHaveCount(0); // 내 블로그에는 이웃 버튼이 없다

    const g = await browser.newPage();
    const guest = await signUpOk(g);
    await g.goto(`/@${owner}`);
    await expect(followBtn(g)).toHaveText("+ 이웃 추가");
    expect((await followBtn(g).boundingBox())!.height).toBeGreaterThanOrEqual(44);

    let dialogs = 0;
    g.on("dialog", (d) => {
      dialogs++;
      d.dismiss();
    });
    await followBtn(g).click();
    await expect(followBtn(g)).toHaveText("✓ 이웃");
    await expect(followBtn(g)).toHaveAttribute("aria-pressed", "true");
    await expect(followers(g)).toHaveText("이웃 1");
    await page.reload();
    await expect(followers(page)).toHaveText("이웃 1");

    await followBtn(g).click();
    await expect(followBtn(g)).toHaveText("+ 이웃 추가");
    await expect(followers(g)).toHaveText("이웃 0");
    expect(dialogs).toBe(0);
    expect(await followRows(guest)).toBe(0);
  });

  test("방문자는 이웃 N만 보이고 버튼이 없다, /feed/following은 첫 화면으로", async ({ page, browser }) => {
    const owner = await signUpOk(page);
    const visitor = await browser.newPage();
    await visitor.goto(`/@${owner}`);
    await expect(followers(visitor)).toHaveText("이웃 0");
    await expect(followBtn(visitor)).toHaveCount(0);
    await visitor.goto("/feed/following");
    await expect(visitor).toHaveURL(/\/$/);
    await visitor.goto("/feed");
    await expect(visitor.getByRole("link", { name: "💛 이웃 새 글" })).toHaveCount(0);
    await expect(visitor.getByRole("link", { name: "🏘 마을 전체" })).toHaveAttribute("aria-current", "page");
  });

  test("이웃 새 글: 이웃 블로그의 공개 글만(추가 전 글 포함), 취소하면 빠진다", async ({ page, browser }) => {
    const a = await signUpOk(page);
    await writePost(page, "이웃 전 글", "본문");
    await writePost(page, "비밀 글", "본문", { private: true });
    const other = await browser.newPage();
    await signUpOk(other);
    await writePost(other, "남의 글", "본문");

    const g = await browser.newPage();
    await signUpOk(g);
    await g.goto("/feed/following");
    await expect(g).toHaveTitle("이웃 새 글 | Blogville");
    await expect(g.getByText("아직 이웃이 없거나 이웃의 새 글이 없어요.")).toBeVisible();
    await expect(g.getByRole("link", { name: "마을 소식", exact: true }).last()).toHaveAttribute("href", "/feed");

    await g.goto(`/@${a}`);
    await followBtn(g).click();
    await expect(followBtn(g)).toHaveText("✓ 이웃");
    await g.goto("/feed/following");
    await expect(g.getByRole("heading", { name: "💛 이웃 새 글" })).toBeVisible();
    await expect(g.getByRole("link", { name: "💛 이웃 새 글" })).toHaveAttribute("aria-current", "page");
    await expect(g.getByRole("heading", { name: "이웃 전 글" })).toBeVisible();
    await expect(g.getByRole("heading", { name: "비밀 글" })).toHaveCount(0);
    await expect(g.getByRole("heading", { name: "남의 글" })).toHaveCount(0);
    // 작성자 줄을 누르면 그 블로그 홈
    await expect(g.getByRole("link", { name: new RegExp(`^${a}의 블로그`) })).toHaveAttribute("href", `/@${a}`);

    // 마지막보다 큰 페이지는 빈 화면 문구
    await g.goto("/feed/following?page=999");
    await expect(g.getByText("아직 이웃이 없거나 이웃의 새 글이 없어요.")).toBeVisible();

    await g.goto(`/@${a}`);
    await followBtn(g).click();
    await expect(followBtn(g)).toHaveText("+ 이웃 추가");
    await g.goto("/feed/following");
    await expect(g.getByRole("heading", { name: "이웃 전 글" })).toHaveCount(0);
  });

  test("조작한 요청(나·없는 회원·블로그 없는 값·65자·숫자)은 저장 안 됨, 동시에 보내도 1행, CHECK가 나를 거부", async ({ page, browser }) => {
    const owner = await signUpOk(page);
    const g = await browser.newPage();
    const guest = await signUpOk(g);
    await g.goto(`/@${owner}`);
    const ownerId = await userId(owner);
    const meId = await userId(guest);

    // 같은 추가 요청을 동시에 10번: 행은 1개를 넘지 않는다
    // 블로그 홈은 열릴 때 방문 기록 요청도 보내므로 이웃 요청만 고른다
    const sent = g.waitForRequest((r) => r.method() === "POST" && !!r.postData()?.includes("followeeId"));
    await followBtn(g).click();
    const req = await sent;
    await expect(followBtn(g)).toHaveText("✓ 이웃");
    const results = await Promise.all(
      Array.from({ length: 10 }, () => g.request.post(req.url(), { headers: req.headers(), data: req.postData()! })),
    );
    expect(results.every((r) => r.status() === 200)).toBe(true);
    expect(await followRows(guest)).toBeLessThanOrEqual(1);

    // 같은 요청의 상대 ID만 바꿔 보낸다: 모두 200, 이웃 행이 생기지 않는다 (#22)
    await sql`delete from follows where follower_id = ${meId}`;
    for (const bad of [meId, "nobody-here", "x".repeat(65), "", "123"]) {
      const res = await g.request.post(req.url(), { headers: req.headers(), data: req.postData()!.replace(ownerId, bad) });
      expect(res.status()).toBe(200);
    }
    expect(await followRows(guest)).toBe(0);
    // 바꾸지 않은 요청은 저장된다 (위 요청이 실제로 서버까지 간다는 확인)
    await g.request.post(req.url(), { headers: req.headers(), data: req.postData()! });
    expect(await followRows(guest)).toBe(1);

    await expect(sql`insert into follows (follower_id, followee_id) values (${meId}, ${meId})`).rejects.toMatchObject({ code: "23514" });
  });

  test("회원을 지우면 이웃 관계도 지워진다", async ({ page, browser }) => {
    const owner = await signUpOk(page);
    const g = await browser.newPage();
    const guest = await signUpOk(g);
    await g.goto(`/@${owner}`);
    await followBtn(g).click();
    await expect(followers(g)).toHaveText("이웃 1");
    await sql`delete from users where username = ${guest}`;
    await page.reload();
    await expect(followers(page)).toHaveText("이웃 0");
  });
});

test.describe("SOC-05 마을 소식", () => {
  test("모든 블로그의 공개 글 최신순 8개, 작성자 줄, 비공개 없음, 페이지 번호, 이상한 page는 1페이지", async ({ page }) => {
    const a = await signUpOk(page);
    try {
      await insertPosts(a, 9);
      // 다른 시험이 동시에 글을 써도 이 글들이 맨 앞에 오도록 하루 뒤로 옮긴다
      // (글 사이 간격은 1초라서 몇 분 전에 돈 같은 시험의 글과도 섞이지 않는다)
      await sql`update posts p set created_at = now() + interval '1 day' + (p.id - m.first) * interval '1 second'
        from (select min(id) as first, blog_id from posts group by blog_id) m
        where m.blog_id = p.blog_id
          and p.blog_id = (select b.id from blogs b join users u on u.id = b.owner_id where u.username = ${a})`;
      await sql`insert into posts (blog_id, title, content_html, content_text, is_public)
        select b.id, '숨은 글', '<p>x</p>', 'x', false from blogs b join users u on u.id = b.owner_id where u.username = ${a}`;
      await page.goto("/feed");
      await expect(page).toHaveTitle("마을 소식 | Blogville");
      await expect(page.getByRole("heading", { name: "📋 마을 소식" })).toBeVisible();
      await expect(page.getByRole("link", { name: "💛 이웃 새 글" })).toBeVisible();
      const cards = page.locator("article");
      await expect(cards).toHaveCount(8);
      await expect(cards.first().getByRole("heading")).toHaveText("글 9");
      await expect(page.getByRole("heading", { name: "숨은 글" })).toHaveCount(0);
      await expect(page.getByText("🔒 비공개")).toHaveCount(0);
      await expect(cards.first().getByRole("link", { name: new RegExp(`^${a}의 블로그`) })).toHaveAttribute("href", `/@${a}`);
      await expect(page.getByRole("heading", { name: "🏷 인기 태그" })).toBeVisible();

      for (const bad of ["abc", "0", "2.5", "1e300"]) {
        await page.goto(`/feed?page=${bad}`);
        await expect(cards.first().getByRole("heading")).toHaveText("글 9");
      }
      await page.goto("/feed");
      await page.getByRole("navigation", { name: "페이지" }).getByRole("link", { name: "2", exact: true }).click();
      await expect(page).toHaveURL(/\/feed\?page=2$/);
      // 2페이지 맨 앞은 이 블로그의 9번째 글(가장 오래된 글 1)
      await expect(cards.first().getByRole("heading")).toHaveText("글 1");
      await expect(cards.first().getByRole("link", { name: new RegExp(`^${a}의 블로그`) })).toBeVisible();
    } finally {
      // 미래로 옮긴 글은 다른 시험(관리자 최근 글 등)의 순서를 흔들므로 지운다
      await sql`delete from posts where blog_id = (select b.id from blogs b join users u on u.id = b.owner_id where u.username = ${a})`;
    }
  });

  test("헤더의 📋 마을 소식으로 들어가고 375px에서 가로 스크롤이 없다", async ({ page, browser }) => {
    const owner = await signUpOk(page);
    await writePost(page, "작은 화면 글", "본문");
    const m = await browser.newPage({ viewport: { width: 375, height: 800 } });
    await signUpOk(m);
    await m.getByRole("link", { name: "마을 소식" }).first().click();
    await expect(m).toHaveURL(/\/feed$/);
    const noScroll = () => m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(await noScroll()).toBe(true);
    await m.goto(`/@${owner}`);
    expect(await noScroll()).toBe(true);
    const box = (await followBtn(m).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeLessThan(60);
    await followBtn(m).click();
    await expect(followBtn(m)).toHaveText("✓ 이웃");
    await m.goto("/feed/following");
    await expect(m.getByRole("heading", { name: "작은 화면 글" })).toBeVisible();
    expect(await noScroll()).toBe(true);
  });
});
