import { expect, test, type Page } from "./fixtures";
import { insertPosts, signUpOk, sql } from "./helpers";

// 친구 마을 구경 (TOWN-15), specs/047-friend-town
test.describe.configure({ timeout: 90_000 });

const canvas = (page: Page) => page.locator("[data-town] canvas");
const feet = async (page: Page) => (await canvas(page).getAttribute("data-feet"))!.split(",").map(Number);
const userId = async (username: string) => (await sql`select id from users where username = ${username}`)[0].id as string;
const short = (name: string) => ([...name].length > 12 ? `${[...name].slice(0, 12).join("")}…` : name);
const menu = (page: Page) => page.locator("[data-town-menu]");
const panel = (page: Page) => page.locator("[data-town-panel]");

test.describe("TOWN-15 친구 마을 구경", () => {
  test("블로그의 [🏘 마을 구경] → 그 회원의 마을: 위에 마을 이름·내 마을로, 그 집 앞에서 시작, 텔레포트 0번은 그 회원의 집", async ({ page, browser }) => {
    const me = await signUpOk(page);
    const pages = [await browser.newPage(), await browser.newPage()];
    const host = await signUpOk(pages[0]);
    const friend = await signUpOk(pages[1]);
    for (const p of pages) await p.close();
    // host가 friend와 나를 즐겨찾기
    await sql`insert into follows (follower_id, followee_id, is_favorite, created_at) values
      (${await userId(host)}, ${await userId(friend)}, true, now() - interval '2 minutes'),
      (${await userId(host)}, ${await userId(me)}, true, now() - interval '1 minute')`;

    await page.goto(`/@${host}`);
    await page.locator("[data-friend-town]").click();
    await expect(page).toHaveURL(new RegExp(`/town/${host}$`));
    await expect(page).toHaveTitle(`${host}님의 마을 | Blogville`);
    await expect(page.locator(`[data-town-host="${host}"]`)).toContainText(`🏘 ${host}님의 마을`);
    await expect(canvas(page)).toHaveAttribute("data-ready", "1");
    expect(await feet(page)).toEqual([1000, 1290]);
    await expect(page.locator("[data-town-prompt]")).toHaveText(`🏠 ${short(host)}의 집 · Space 들어가기`);
    await expect(canvas(page)).toHaveAttribute("aria-label", `${host}님의 마을 지도. 방향키로 걷고 Space로 들어가요`);

    await menu(page).click();
    await panel(page).getByRole("button", { name: /✨ 텔레포트/ }).click();
    await expect(panel(page)).toContainText(`집 (${host}님 집 + 즐겨찾기 이웃 10자리)`);
    const lots = panel(page).locator("[data-spot]");
    await expect(lots.nth(0)).toContainText(`🏠 ${short(host)}의 집`);
    await expect(lots.nth(1)).toContainText(`🏠 ${short(friend)}의 집`);
    await expect(lots.nth(2)).toContainText("🏠 내 집");
    await page.keyboard.press("Escape");

    // 마을 이름 간판은 왼쪽 간판 묶음과 겹치지 않는다 (1280px은 위 가운데, 좁으면 묶음 아래 둘째 줄)
    const sign = page.locator(`[data-town-host="${host}"]`);
    const group = page.locator("[data-town-hud-row]").first();
    for (const width of [1280, 768]) {
      await page.setViewportSize({ width, height: 720 });
      const [a, b] = [(await sign.boundingBox())!, (await group.boundingBox())!];
      const apart = a.x >= b.x + b.width || a.y >= b.y + b.height;
      expect(apart, `${width}px`).toBe(true);
    }
    await page.setViewportSize({ width: 1280, height: 720 });

    // 광장 소식 서랍은 그 마을 이웃의 새 글: 내 이웃 새 글(/feed/following)이 아니다
    const drawer = page.getByRole("complementary", { name: "광장 소식" });
    await drawer.getByRole("button", { name: /^마을 소식 펼치기/ }).click();
    await expect(drawer.locator('[data-town-news="village"]')).toContainText(`⭐ ${host}님이 즐겨찾는 이웃의 새 글이 없어서 마을 전체의 새 글을 보여 드려요.`);
    await insertPosts(friend, 1);
    await page.reload();
    await expect(canvas(page)).toHaveAttribute("data-ready", "1");
    const news = drawer.locator('[data-town-news="neighbors"]');
    await expect(drawer.getByRole("tab", { name: /이웃 새 글/ })).toHaveAttribute("aria-selected", "true");
    await expect(news).toContainText(`⭐ ${host}님이 즐겨찾는 이웃의 새 글이에요.`);
    await expect(news.locator("[data-news-post]")).toHaveAttribute("href", new RegExp(`^/@${friend}/\\d+$`));
    await expect(news.locator('a[href="/feed/following"]')).toHaveCount(0);
    await expect(news.getByRole("link", { name: /님 블로그 ›$/ })).toHaveAttribute("href", `/@${host}`);

    await sign.getByRole("link", { name: "🏠 내 마을로" }).click();
    await expect(page).toHaveURL(/\/town$/);
  });

  test("친구 목록 🏘·우체통 [마을 구경]으로도 간다. 내 주소는 내 마을, 없는 주소·공지 블로그는 404, 방문자는 첫 화면", async ({ page, browser }) => {
    const me = await signUpOk(page);
    const other = await browser.newPage();
    const host = await signUpOk(other);
    await other.close();
    await sql`insert into follows (follower_id, followee_id, is_favorite) values (${await userId(me)}, ${await userId(host)}, true)`;

    await page.goto("/town");
    await expect(canvas(page)).toHaveAttribute("data-ready", "1");
    await menu(page).click();
    await panel(page).getByRole("button", { name: /👫 친구 목록/ }).click();
    await panel(page).getByRole("link", { name: `${host}님의 마을 구경` }).click();
    await expect(page).toHaveURL(new RegExp(`/town/${host}$`));

    // 내 마을의 1번 집 우체통
    await page.goto("/town");
    await expect(canvas(page)).toHaveAttribute("data-ready", "1");
    await canvas(page).evaluate((c) => c.dispatchEvent(new CustomEvent("bv-teleport", { detail: { x: 418, y: 420 } })));
    await page.keyboard.press("Space");
    await page.locator('[data-town-panel="mailbox"]').getByRole("link", { name: `🏘 ${host}님의 마을 구경` }).click();
    await expect(page).toHaveURL(new RegExp(`/town/${host}$`));

    await page.goto(`/town/${me}`);
    await expect(page).toHaveURL(/\/town$/);
    for (const slug of ["no-such-blog-zz", "notice"]) {
      const res = await page.goto(`/town/${slug}`);
      expect(res?.status()).toBe(404);
    }
    // 공지 블로그와 내 블로그에는 [🏘 마을 구경]이 없다
    await page.goto(`/@${me}`);
    await expect(page.locator("[data-friend-town]")).toHaveCount(0);

    const guest = await browser.newPage();
    await guest.goto(`/town/${host}`);
    await expect(guest).toHaveURL(/\/$/);
    await guest.close();
  });

  test("휴대폰(375px)에서는 그 회원의 블로그로 가고, 블로그에 [🏘 마을 구경]이 안 보인다", async ({ browser }) => {
    const other = await browser.newPage();
    const host = await signUpOk(other);
    await other.close();
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await signUpOk(page);
    await page.goto(`/town/${host}`);
    await expect(page).toHaveURL(new RegExp(`/@${host}$`));
    await expect(page.locator("[data-friend-town]")).toBeHidden();
    await ctx.close();
  });

  test("친구 농장 구경 (plaza-upgrade-2 C4): /farm?host=는 읽기 전용, [광장으로]는 그 친구 마을 외양간, 내 주소는 내 농장, 상점도 돌아가는 길만 이어 받는다", async ({ page, browser }) => {
    const me = await signUpOk(page);
    const other = await browser.newPage();
    const host = await signUpOk(other);
    await other.close();
    const hostId = await userId(host);
    await sql`insert into animals (user_id, species, source, growth, hatched_at) values (${hostId}, 'chick', 'first', 3, now())`;
    await sql`insert into animals (user_id, species, source, growth, hatched_at, grown_at) values (${hostId}, 'rabbit', 'buy', 40, now() - interval '2 days', now() - interval '1 day')`;

    await page.goto(`/farm?host=${host}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`🐮 ${host}님의 농장 구경`);
    await expect(page).toHaveTitle(`${host}님의 농장 구경 | Blogville`);
    await expect(page.locator('[data-animal="chick"]')).toHaveCount(1);
    await expect(page.locator('[data-grown="rabbit"]')).toHaveCount(1);
    await expect(page.locator("[data-room]").getByRole("button")).toHaveCount(0);
    await expect(page.locator("[data-farm-wallet]")).toHaveCount(0);
    await expect(page.locator("[data-room-exit]")).toHaveAttribute("href", `/town/${host}?from=farm`);

    // 내 주소면 내 농장, 모르는 주소는 404
    await page.goto(`/farm?host=${me}`);
    await expect(page).toHaveURL(/\/farm$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("🐮 동물 농장");
    await expect(page.locator("[data-room-exit]")).toHaveAttribute("href", "/town?from=farm");
    expect((await page.goto("/farm?host=no_such_blog_zz"))?.status()).toBe(404);

    // 상점은 내 것 그대로, [광장으로]만 친구 마을 상점 앞으로
    await page.goto(`/shop?host=${host}`);
    await expect(page.locator("[data-room-exit]")).toHaveAttribute("href", `/town/${host}?from=shop`);
    await page.goto("/shop?host=../evil");
    await expect(page.locator("[data-room-exit]")).toHaveAttribute("href", "/town?from=shop");
  });

  // A6(외양간 입구 href ?host=)·B([slug]의 from=)와 합친 뒤 켠다
  test.fixme("합친 뒤: 친구 마을 외양간 Space → /farm?host=, [광장으로] → 친구 마을 외양간 문 앞", async ({ page, browser }) => {
    await signUpOk(page);
    const other = await browser.newPage();
    const host = await signUpOk(other);
    await other.close();
    await page.goto(`/town/${host}`);
    await expect(canvas(page)).toHaveAttribute("data-ready", "1");
    await menu(page).click();
    await panel(page).getByRole("button", { name: /✨ 텔레포트/ }).click();
    await panel(page).locator("[data-spot]").filter({ hasText: "농장" }).click();
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(`/farm?host=${host}`);
    await page.locator("[data-room-exit]").click();
    await expect(page).toHaveURL(`/town/${host}?from=farm`);
    await expect(canvas(page)).toHaveAttribute("data-ready", "1");
    const door = await feet(page);
    expect(door).not.toEqual([1000, 1290]);
  });
});
