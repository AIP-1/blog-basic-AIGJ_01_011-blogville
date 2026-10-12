import { expect, test, type Browser, type Page } from "@playwright/test";
import { insertPosts, signUpOk, sql, writePost } from "./helpers";

// 조회수(POST-06)·방문자(BLOG-06)·옆 칸 위젯과 블로그 안 검색(BLOG-09)
test.describe.configure({ timeout: 60_000 });

async function owner(browser: Browser) {
  const page = await browser.newPage();
  const username = await signUpOk(page);
  const [{ id: blogId }] = await sql`select b.id from blogs b join users u on u.id = b.owner_id where u.username = ${username}`;
  return { page, username, blogId: blogId as number };
}

const views = (page: Page) => page.locator("article").first().getByLabel(/^조회 \d+$/);
const visit = (page: Page, label: "오늘" | "어제" | "전체") => page.locator(`[data-visit="${label}"]`);
const widget = (page: Page, name: string) => page.getByRole("complementary", { name: "옆 칸" }).getByRole("region", { name });

test.describe("POST-06 조회수", () => {
  test("다른 브라우저마다 하루 1번, 주인·비공개·서버 렌더는 세지 않는다", async ({ browser }) => {
    const o = await owner(browser);
    const id = await writePost(o.page, "조회 글", "본문");
    const secretId = await writePost(o.page, "비밀", "본문", { private: true });
    const [{ updated_at: before }] = await sql`select updated_at from posts where id = ${id}`;

    // 주인은 세지 않는다
    await o.page.goto(`/@${o.username}/${id}`);
    await expect(views(o.page)).toHaveText("👀 0");

    // 링크 미리 불러오기·로봇처럼 HTML만 받아 가면 세지 않는다
    await o.page.request.get(`/@${o.username}/${id}`, { headers: { cookie: "" } });

    const a = await browser.newPage();
    await a.goto(`/@${o.username}/${id}`);
    await expect(views(a)).toHaveText("👀 1");
    await expect.poll(async () => (await sql`select view_count from posts where id = ${id}`)[0].view_count).toBe(1);
    // 쿠키는 기록 요청의 응답으로 심긴다: 응답이 올 때까지 기다린다
    const visitorCookie = async () => (await a.context().cookies()).find((c) => c.name === "bv_visitor");
    await expect.poll(visitorCookie).toBeTruthy();
    const cookie = (await visitorCookie())!;
    expect(cookie.value).toMatch(/^[0-9a-f-]{36}$/);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
    expect(cookie.expires - Date.now() / 1000).toBeGreaterThan(364 * 24 * 3600);

    await a.reload();
    await expect(views(a)).toHaveText("👀 1");
    const b = await browser.newPage();
    await b.goto(`/@${o.username}/${id}`);
    await expect(views(b)).toHaveText("👀 2");
    await a.reload();
    await expect(views(a)).toHaveText("👀 2");

    // 조회수가 올라도 글의 수정 시각은 그대로
    const [{ updated_at: after }] = await sql`select updated_at from posts where id = ${id}`;
    expect(after).toEqual(before);

    // 목록 카드
    await b.goto(`/@${o.username}`);
    await expect(b.getByLabel("조회 2")).toBeVisible();

    // 비공개 글은 주인이 열어도 0, 다른 사람은 404
    await o.page.goto(`/@${o.username}/${secretId}`);
    await expect(views(o.page)).toHaveText("👀 0");
    expect((await b.goto(`/@${o.username}/${secretId}`))!.status()).toBe(404);
    const [{ view_count }] = await sql`select view_count from posts where id = ${secretId}`;
    expect(view_count).toBe(0);

    // 기록 줄은 같은 브라우저·같은 날 1줄만 (DB 기본 키)
    const [row] = await sql`select date, visitor_id from post_views where post_id = ${id} limit 1`;
    await expect(sql`insert into post_views (post_id, date, visitor_id) values (${id}, ${row.date}, ${row.visitor_id})`).rejects.toMatchObject({ code: "23505" });
  });
});

test.describe("BLOG-06 방문자", () => {
  test("오늘·어제·전체, 같은 날 다시 와도 1번, 글 상세도 방문, 주인은 세지 않는다", async ({ browser }) => {
    const o = await owner(browser);
    const id = await writePost(o.page, "방문 글", "본문");
    await o.page.goto(`/@${o.username}`);
    await expect(visit(o.page, "오늘")).toHaveText("0");

    const a = await browser.newPage();
    await a.goto(`/@${o.username}`);
    await expect(visit(a, "오늘")).toHaveText("1");
    await expect(visit(a, "전체")).toHaveText("1");
    await a.goto(`/@${o.username}?page=2`);
    await a.goto(`/@${o.username}/${id}`);
    await a.goto(`/@${o.username}`);
    await expect(visit(a, "오늘")).toHaveText("1");

    // 글 상세로 먼저 온 사람도 방문자, 이어서 홈에 와도 더 오르지 않는다
    const b = await browser.newPage();
    await b.goto(`/@${o.username}/${id}`);
    await expect(views(b)).toHaveText("👀 2");
    // "👀 2"는 서버 렌더가 미리 +1 한 값이다. 기록 요청이 방문자 쿠키를 심기 전에 떠나면
    // 홈에서 새 방문자로 한 번 더 세어진다(가끔 오늘 3이 되던 원인). 쿠키가 생길 때까지 기다린다.
    await expect.poll(async () => (await b.context().cookies()).some((c) => c.name === "bv_visitor")).toBe(true);
    await b.goto(`/@${o.username}`);
    await expect(visit(b, "오늘")).toHaveText("2");

    // 어제 기록
    await sql`insert into blog_visits (blog_id, date, visitor_id) values (${o.blogId}, (now() at time zone 'Asia/Seoul')::date - 1, gen_random_uuid())`;
    await o.page.reload();
    await expect(visit(o.page, "어제")).toHaveText("1");
    await expect(visit(o.page, "오늘")).toHaveText("2");
    await expect(visit(o.page, "전체")).toHaveText("3");
    expect(await sql`select 1 from blog_visits where blog_id = ${o.blogId}`).toHaveLength(3);
  });
});

test.describe("BLOG-09 옆 칸", () => {
  test("최근 글·인기 글·최근 댓글·태그: 남에게는 비공개 글과 그 댓글·태그가 없다", async ({ browser }) => {
    const o = await owner(browser);
    await insertPosts(o.username, 6);
    const posts = await sql`select id, title from posts where blog_id = ${o.blogId} order by id`;
    const secret = await writePost(o.page, "비밀 글", "본문", { private: true });
    const [{ id: authorId }] = await sql`select u.id from users u where u.username = ${o.username}`;
    // 인기: 글 2가 5회, 글 4가 3회, 비밀 글이 9회
    await sql`update posts set view_count = case id when ${posts[1].id} then 5 when ${posts[3].id} then 3 when ${secret} then 9 else 0 end where blog_id = ${o.blogId}`;
    const [c1] = await sql`insert into comments (post_id, author_id, content) values (${posts[0].id}, ${authorId}, '공개 글 댓글') returning id`;
    await sql`insert into replies (comment_id, author_id, content) values (${c1.id}, ${authorId}, '공개 글 답글')`;
    await sql`insert into comments (post_id, author_id, content) values (${secret}, ${authorId}, '비밀 글 댓글')`;
    await sql`insert into comments (post_id, author_id, content, deleted_at) values (${posts[0].id}, ${authorId}, '', now())`;
    await sql`insert into tags (name) values ('여행'), ('비밀태그') on conflict do nothing`;
    await sql`insert into post_tags (post_id, tag_id) select p, t.id from tags t, unnest(${[posts[0].id, posts[1].id]}::int[]) p where t.name = '여행'`;
    await sql`insert into post_tags (post_id, tag_id) select ${secret}, id from tags where name = '비밀태그'`;

    const v = await browser.newPage();
    await v.goto(`/@${o.username}`);
    await expect(widget(v, "📝 최근 글").getByRole("link")).toHaveText(["글 6", "글 5", "글 4", "글 3", "글 2"]);
    await expect(widget(v, "🔥 인기 글").getByRole("link")).toHaveText(["글 2👀 5", "글 4👀 3"]);
    const recent = widget(v, "💬 최근 댓글").getByRole("link");
    await expect(recent).toHaveCount(2);
    await expect(recent.nth(0)).toContainText("↳ 공개 글 답글");
    await expect(recent.nth(1)).toHaveAttribute("href", `/@${o.username}/${posts[0].id}#comment-${c1.id}`);
    await expect(widget(v, "🏷 태그").getByRole("link")).toHaveText(["#여행 2"]);

    // 댓글 자리로 바로 간다
    await recent.nth(1).click();
    await expect(v).toHaveURL(new RegExp(`#comment-${c1.id}$`));
    await expect(v.locator(`#comment-${c1.id}`)).toBeInViewport();

    // 주인에게는 비공개 글·그 댓글·태그도
    await o.page.goto(`/@${o.username}`);
    await expect(widget(o.page, "📝 최근 글").getByRole("link").first()).toHaveText("비밀 글");
    await expect(widget(o.page, "🔥 인기 글").getByRole("link").first()).toContainText("비밀 글");
    await expect(widget(o.page, "💬 최근 댓글")).toContainText("비밀 글 댓글");
    await expect(widget(o.page, "🏷 태그").getByRole("link")).toHaveText(["#여행 2", "#비밀태그 1"]);
    // `전체 글 (N)`은 누가 보든 공개 글 수
    await expect(o.page.getByRole("navigation", { name: "카테고리" }).getByRole("link").first()).toContainText("(6)");

    // 태그를 누르면 이 블로그의 그 태그 글만
    await v.goto(`/@${o.username}`);
    await widget(v, "🏷 태그").getByRole("link", { name: /여행/ }).click();
    await expect(v).toHaveURL(new RegExp(`/@${o.username}\\?tag=`));
    await expect(v.getByRole("heading", { level: 2, name: "#여행 2개" })).toBeVisible();
    await expect(widget(v, "🏷 태그").getByRole("link", { name: /여행/ })).toHaveAttribute("aria-current", "page");
    await v.getByRole("link", { name: "← 전체 글 보기" }).click();
    await expect(v.getByRole("heading", { level: 2, name: "전체 글 6개" })).toBeVisible();
    await v.goto(`/@${o.username}?tag=${encodeURIComponent("비밀태그")}`);
    await expect(v.getByText("이 블로그에서 찾은 글이 없어요")).toBeVisible();
  });

  test("블로그 검색: 제목·본문, %는 글자 그대로, 빈 검색은 문구, 페이지를 넘겨도 검색어 유지", async ({ browser }) => {
    const o = await owner(browser);
    await insertPosts(o.username, 10);
    await writePost(o.page, "할인 100% 후기", "정말 좋았다");
    await writePost(o.page, "그냥 글", "본문에 Next.js 이야기");
    const v = await browser.newPage();
    await v.goto(`/@${o.username}`);
    const box = v.getByRole("searchbox", { name: "블로그 검색어" });
    await expect(box).toHaveAttribute("maxlength", "50");

    await box.fill("next.JS");
    await box.press("Enter");
    await expect(v).toHaveURL(new RegExp(`\\?s=next.JS$`));
    await expect(v.getByRole("heading", { level: 2, name: "🔍 'next.JS' 블로그 검색 1개" })).toBeVisible();
    await expect(box).toHaveValue("next.JS");

    await v.goto(`/@${o.username}?s=${encodeURIComponent("100%")}`);
    await expect(v.getByRole("heading", { level: 2 }).first()).toHaveText("🔍 '100%' 블로그 검색 1개");
    await v.goto(`/@${o.username}?s=${encodeURIComponent("0%")}`);
    await expect(v.getByRole("heading", { level: 2 }).first()).toHaveText("🔍 '0%' 블로그 검색 1개");
    await v.goto(`/@${o.username}?s=_`);
    await expect(v.getByText("이 블로그에서 찾은 글이 없어요")).toBeVisible();

    await v.goto(`/@${o.username}?s=%20%20`);
    await expect(v.getByRole("alert").filter({ hasText: "찾을 말을 적어 주세요" })).toBeVisible();

    await v.goto(`/@${o.username}?s=${encodeURIComponent("본문")}`);
    await expect(v.getByRole("heading", { level: 2 }).first()).toHaveText("🔍 '본문' 블로그 검색 11개");
    await v.getByRole("navigation", { name: "페이지" }).getByRole("link", { name: "2" }).click();
    await expect(v).toHaveURL(/\?s=%EB%B3%B8%EB%AC%B8&page=2$/);
    await expect(v.locator("section[aria-labelledby=list-title] article")).toHaveCount(3);
  });

  test("375px에서 옆 칸이 글 목록 아래로, 가로 스크롤 없음", async ({ browser }) => {
    const o = await owner(browser);
    await writePost(o.page, "아주 긴 제목 ".repeat(8), "본문");
    await o.page.setViewportSize({ width: 375, height: 812 });
    await o.page.goto(`/@${o.username}`);
    const list = await o.page.locator("section[aria-labelledby=list-title]").boundingBox();
    const side = await o.page.getByRole("complementary", { name: "옆 칸" }).boundingBox();
    expect(side!.y).toBeGreaterThan(list!.y + list!.height - 1);
    expect(await o.page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});
