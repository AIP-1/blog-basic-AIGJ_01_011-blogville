import { expect, test, type Page } from "./fixtures";
import { signIn, signUpOk, sql } from "./helpers";

// 집 앞 우체통 (TOWN-13), specs/043-mailbox
test.describe.configure({ timeout: 90_000 });

const canvas = (page: Page) => page.locator("[data-town] canvas");
const prompt = (page: Page) => page.locator("[data-town-prompt]");
const panel = (page: Page) => page.locator('[data-town-panel="mailbox"]');
const feet = async (page: Page) => (await canvas(page).getAttribute("data-feet"))!.split(",").map(Number);
const teleport = (page: Page, x: number, y: number) =>
  canvas(page).evaluate((c, d) => c.dispatchEvent(new CustomEvent("bv-teleport", { detail: d })), { x, y });
const short = (name: string) => ([...name].length > 12 ? `${[...name].slice(0, 12).join("")}…` : name);
const userId = async (username: string) => (await sql`select id from users where username = ${username}`)[0].id as string;

async function openTown(page: Page) {
  await page.goto("/town");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
}

test.describe("TOWN-13 집 앞 우체통", () => {
  test("이웃 집 우체통: 최근 공개 글 3개(비공개 없음)·글로 가기·집 앞으로, 글이 없으면 문구", async ({ page, browser }) => {
    const me = await signUpOk(page);
    const others = [await browser.newPage(), await browser.newPage()];
    const writer = await signUpOk(others[0]);
    const quiet = await signUpOk(others[1]);
    for (const o of others) await o.close();
    const [blog] = await sql`select id from blogs where slug = ${writer}`;
    // 아주 옛 날짜로 넣어 다른 시험의 목록 첫 쪽을 건드리지 않는다
    for (const [i, title, pub] of [
      [1, "첫 편지", true],
      [2, "둘째 편지", true],
      [3, "비밀 편지", false],
      [4, "셋째 편지", true],
      [5, "넷째 편지", true],
    ] as const) {
      await sql`insert into posts (blog_id, title, content_html, content_text, is_public, created_at)
        values (${blog.id}, ${title}, '<p>본문</p>', '본문', ${pub}, '2000-01-01'::timestamptz + make_interval(mins => ${i}))`;
    }
    await sql`insert into follows (follower_id, followee_id, is_favorite, created_at) values
      (${await userId(me)}, ${await userId(writer)}, true, now() - interval '2 minutes'),
      (${await userId(me)}, ${await userId(quiet)}, true, now() - interval '1 minute')`;

    await openTown(page);
    // 1번 자리(300, 380) 오른쪽 앞 우체통
    await teleport(page, 418, 420);
    await expect(prompt(page)).toHaveText(`📬 ${short(writer)}의 우체통 · Space 소식 보기`);
    await page.keyboard.press("Space");
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByRole("heading")).toHaveText(`📮 ${writer}님의 우체통`);
    await expect(panel(page)).toContainText(`${writer}의 블로그의 새 글`);
    const posts = panel(page).getByRole("list", { name: "새 글" }).getByRole("link");
    await expect(posts).toHaveText(["✉️넷째 편지", "✉️셋째 편지", "✉️둘째 편지"]);
    // 창이 열려 있는 동안 방향키로 걷지 않는다
    await page.keyboard.press("ArrowLeft");
    expect(await feet(page)).toEqual([418, 420]);

    await panel(page).getByRole("button", { name: "✨ 집 앞으로" }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect.poll(() => feet(page)).toEqual([300, 420]);

    // 2번 자리: 공개 글이 없다
    await teleport(page, 418, 680);
    await page.keyboard.press("Enter");
    await expect(panel(page)).toContainText("아직 공개 글이 없어요.");
    await page.keyboard.press("Escape");
    await expect(panel(page)).toHaveCount(0);

    await teleport(page, 418, 420);
    await page.keyboard.press("Space");
    await posts.first().click();
    await expect(page).toHaveURL(new RegExp(`/@${writer}/\\d+$`));
    await expect(page.getByRole("heading", { name: "넷째 편지" })).toBeVisible();
  });

  test("내 우체통은 파랑, 안 읽은 알림이 있으면 깃발, 열면 내 알림 5개와 알림함 링크", async ({ page, browser }) => {
    const me = await signUpOk(page);
    const other = await browser.newPage();
    const actor = await signUpOk(other);
    await other.close();
    await openTown(page);
    expect(await canvas(page).getAttribute("data-mail-flag")).toBe("0");
    await teleport(page, 1118, 1290);
    await expect(prompt(page)).toHaveText("📬 내 우체통 · Space 소식 보기");
    await page.keyboard.press("Space");
    await expect(panel(page).getByRole("heading")).toHaveText("📮 내 우체통");
    await expect(panel(page)).toContainText("아직 알림이 없어요.");
    await page.keyboard.press("Escape");

    const [blog] = await sql`select id from blogs where slug = ${me}`;
    const [post] = await sql`insert into posts (blog_id, title, content_html, content_text, created_at)
      values (${blog.id}, '알림 받을 글', '<p>본문</p>', '본문', '2000-01-01') returning id`;
    await sql`insert into notifications (user_id, kind, actor_id, post_id) values (${await userId(me)}, 'like', ${await userId(actor)}, ${post.id})`;
    await openTown(page);
    expect(await canvas(page).getAttribute("data-mail-flag")).toBe("1");
    await teleport(page, 1118, 1290);
    await page.keyboard.press("Space");
    await expect(panel(page).locator('[data-notification="unread"]')).toHaveCount(1);
    await expect(panel(page).getByRole("link", { name: "알림함 전체 보기 ›" })).toBeVisible();
  });
});

// 우체통 쪽지(방명록)와 오늘 방문 수 (plaza-upgrade-2 B3)
test.describe("B3 우체통 쪽지", () => {
  test("이웃 우체통에 쪽지를 넣으면 '쪽지를 넣었어요 ✓', 서 있던 자리 그대로, 그 블로그 방명록과 주인 알림. 방문 수, 시간당 상한", async ({ page, browser }) => {
    const me = await signUpOk(page);
    const other = await browser.newPage();
    const friend = await signUpOk(other);
    await other.close();
    const meId = await userId(me);
    const friendId = await userId(friend);
    await sql`insert into follows (follower_id, followee_id, is_favorite) values (${meId}, ${friendId}, true)`;
    const [blog] = await sql`select id from blogs where slug = ${friend}`;
    // 오늘 방문 1, 어제 방문 2
    await sql`insert into blog_visits (blog_id, date, visitor_id) values
      (${blog.id}, (now() at time zone 'Asia/Seoul')::date, gen_random_uuid()),
      (${blog.id}, (now() at time zone 'Asia/Seoul')::date - 1, gen_random_uuid()),
      (${blog.id}, (now() at time zone 'Asia/Seoul')::date - 1, gen_random_uuid())`;

    await openTown(page);
    await teleport(page, 418, 420);
    await expect(prompt(page)).toHaveText(`📬 ${short(friend)}의 우체통 · Space 소식 보기`);
    await page.keyboard.press("Space");
    await expect(panel(page)).toContainText("오늘 1명 · 어제 2명이 다녀갔어요");
    await panel(page).getByRole("button", { name: "✉️ 쪽지 넣기" }).click();
    const box = panel(page).getByRole("textbox", { name: /쪽지/ });
    await expect(box).toBeFocused();
    // 글 칸에 쓰는 동안 게임은 걷지 않는다 (방향키·Space)
    await box.fill("안녕");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("End");
    await panel(page).getByRole("button", { name: "쪽지 넣기", exact: true }).click();
    await expect(panel(page).getByRole("status")).toHaveText("쪽지를 넣었어요 ✓");
    expect(await feet(page)).toEqual([418, 420]);
    const entries = await sql`select content, is_secret from guestbook_entries where blog_id = ${blog.id} and author_id = ${meId}`;
    expect(entries).toEqual([{ content: "안녕", is_secret: false }]);
    expect((await sql`select count(*)::int as n from notifications where user_id = ${friendId} and kind = 'guestbook'`)[0].n).toBe(1);

    // 비밀 쪽지
    await panel(page).getByRole("button", { name: "한 장 더 쓰기" }).click();
    await panel(page).getByRole("textbox", { name: /쪽지/ }).fill("비밀 인사");
    await panel(page).getByText("🔒 비밀 쪽지").click();
    await panel(page).getByRole("button", { name: "쪽지 넣기", exact: true }).click();
    await expect(panel(page).getByRole("status")).toHaveText("쪽지를 넣었어요 ✓");
    expect((await sql`select is_secret from guestbook_entries where blog_id = ${blog.id} and content = '비밀 인사'`)[0].is_secret).toBe(true);

    // 그 블로그 방명록에 보인다
    await page.goto(`/@${friend}/guestbook`);
    await expect(page.getByText("안녕", { exact: true })).toBeVisible();

    // 1시간에 10개: 이미 10개를 썼으면 거절 (방명록 화면과 같은 상한)
    for (let i = 0; i < 8; i++) await sql`insert into guestbook_entries (blog_id, author_id, content) values (${blog.id}, ${meId}, ${"채우기 " + i})`;
    await openTown(page);
    await teleport(page, 418, 420);
    await page.keyboard.press("Space");
    await panel(page).getByRole("button", { name: "✉️ 쪽지 넣기" }).click();
    await panel(page).getByRole("textbox", { name: /쪽지/ }).fill("열한 번째");
    await panel(page).getByRole("button", { name: "쪽지 넣기", exact: true }).click();
    await expect(panel(page).getByRole("alert")).toContainText("1시간에 10개");
    expect((await sql`select count(*)::int as n from guestbook_entries where author_id = ${meId}`)[0].n).toBe(10);
  });

  test("내 우체통은 오늘 우리 집 방문 수, 방명록 알림은 ✉️", async ({ page, browser }) => {
    const me = await signUpOk(page);
    const other = await browser.newPage();
    const guest = await signUpOk(other);
    await other.close();
    const [blog] = await sql`select id from blogs where slug = ${me}`;
    await sql`insert into blog_visits (blog_id, date, visitor_id) values (${blog.id}, (now() at time zone 'Asia/Seoul')::date, gen_random_uuid())`;
    const [entry] = await sql`insert into guestbook_entries (blog_id, author_id, content) values (${blog.id}, ${await userId(guest)}, '놀러 왔어요') returning id`;
    await sql`insert into notifications (user_id, kind, actor_id, guestbook_entry_id) values (${await userId(me)}, 'guestbook', ${await userId(guest)}, ${entry.id})`;
    await openTown(page);
    await teleport(page, 1118, 1290);
    await page.keyboard.press("Space");
    await expect(panel(page)).toContainText("오늘 우리 집 방문 1 (어제 0)");
    await expect(panel(page).locator("[data-notification]").first()).toContainText(`✉️ ${guest}님이 방명록에 글을 남겼어요`);
    // 내 우체통에는 쪽지 칸이 없다
    await expect(panel(page).getByRole("button", { name: "✉️ 쪽지 넣기" })).toHaveCount(0);
  });
});

// 이웃 새 글 '읽음' (plaza-upgrade-2 B4): 이 브라우저(방문자 쿠키)로 읽은 글은 칩에서 빠지고 ✓
test.describe("B4 읽은 새 글", () => {
  test("안 읽은 새 글 2편이면 칩 2, 한 편 읽고 오면 1과 ✓, 다 읽으면 다 읽었어요. 다른 브라우저에서는 다시 2", async ({ page, browser }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const me = await signUpOk(page);
    const other = await browser.newPage();
    const writer = await signUpOk(other);
    await other.close();
    await sql`insert into follows (follower_id, followee_id, is_favorite) values (${await userId(me)}, ${await userId(writer)}, true)`;
    const [blog] = await sql`select id from blogs where slug = ${writer}`;
    const ids: number[] = [];
    for (const [i, title] of [
      [2, "첫 새 글"],
      [1, "둘째 새 글"],
    ] as const) {
      const [p] = await sql`insert into posts (blog_id, title, content_html, content_text, created_at)
        values (${blog.id}, ${title}, '<p>본문</p>', '본문', now() - make_interval(mins => ${i})) returning id`;
      ids.push(p.id as number);
    }
    const drawer = page.getByRole("complementary", { name: "광장 소식" });
    const tab = drawer.getByRole("tab", { name: /불 켜진 집/ });
    await openTown(page);
    await expect(tab.locator("[data-unread]")).toHaveText("2");
    await expect(drawer.locator("[data-town-all-read]")).toHaveCount(0);

    await drawer.locator(`[data-news-post="${ids[1]}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/@${writer}/${ids[1]}$`));
    await expect.poll(async () => (await sql`select count(*)::int as n from post_views where post_id = ${ids[1]}`)[0].n).toBe(1);
    // 조회 기록 응답이 방문자 쿠키를 심은 뒤에 광장으로 (쿠키 기준 읽음)
    await expect.poll(async () => (await page.context().cookies()).some((c) => c.name === "bv_visitor")).toBe(true);
    await openTown(page);
    await expect(tab.locator("[data-unread]")).toHaveText("1");
    await expect(drawer.locator(`[data-news-post="${ids[1]}"]`)).toHaveAttribute("data-read", "1");
    await expect(drawer.locator(`[data-news-post="${ids[1]}"]`)).toContainText("✓");
    // 우체통에도 읽은 글 표시
    await teleport(page, 418, 420);
    await page.keyboard.press("Space");
    await expect(panel(page).locator('[data-read="1"]')).toHaveCount(1);
    await page.keyboard.press("Escape");

    await drawer.locator(`[data-news-post="${ids[0]}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/@${writer}/${ids[0]}$`));
    await expect.poll(async () => (await sql`select count(*)::int as n from post_views where post_id = ${ids[0]}`)[0].n).toBe(1);
    await openTown(page);
    await expect(tab.locator("[data-unread]")).toHaveText("✓");
    await expect(drawer.locator("[data-town-all-read]")).toHaveText("오늘 이웃 새 글을 다 읽었어요 🌙");

    // 다른 브라우저(쿠키가 다르다)에서는 다시 안 읽은 2편
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const fresh = await context.newPage();
    await signIn(fresh, me);
    await expect(fresh).toHaveURL("/town");
    await openTown(fresh);
    await expect(fresh.getByRole("complementary", { name: "광장 소식" }).getByRole("tab", { name: /불 켜진 집/ }).locator("[data-unread]")).toHaveText("2");
    await context.close();
  });
});
