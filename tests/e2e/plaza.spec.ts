import { expect, test, type Page } from "./fixtures";
import { insertPosts, signUpOk, sql } from "./helpers";

// 광장 HUD (광장 개편 "등불 마을"): 왼쪽 위 간판 묶음(☰·Blogville·지갑 칩·✏️ 글쓰기), 위 가운데 장소 간판,
// 오른쪽 위 광장 소식 서랍(이웃 새 글·오늘 할 일), 안 읽은 알림 다시 읽기, ?from= 시작 자리.
// PC 화면에도 휴대폰 광장이 숨은 채 그려져 있어 훅은 `[data-town]` 안에서 찾는다.
test.describe.configure({ timeout: 120_000 });

const town = (page: Page) => page.locator("[data-town]");
const canvas = (page: Page) => page.locator("[data-town] canvas");
const feet = async (page: Page) => (await canvas(page).getAttribute("data-feet"))!.split(",").map(Number);
const prompt = (page: Page) => page.locator("[data-town-prompt]");
const panel = (page: Page) => page.locator("[data-town-panel]");
const drawer = (page: Page) => page.getByRole("complementary", { name: "광장 소식" });
const userId = async (username: string) => (await sql`select id from users where username = ${username}`)[0].id as string;
async function openTown(page: Page, url = "/town") {
  await page.goto(url);
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
}

test.describe("광장 HUD", () => {
  test("지갑 칩은 내 프로필을 열고 닫으면 칩으로 초점, ✏️ 글쓰기는 오늘 글 보상 칸, 방문자는 가입하고 글쓰기", async ({ page, browser }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const username = await signUpOk(page);
    await openTown(page);
    const wallet = town(page).locator("[data-town-wallet]");
    await expect(wallet).toHaveAccessibleName(/^내 프로필 열기: Lv\.1, 코인 /);
    await wallet.click();
    await expect(panel(page)).toHaveAttribute("data-town-panel", "profile");
    await expect(panel(page).locator("[data-town-coin]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel(page)).toHaveCount(0);
    await expect(wallet).toBeFocused();
    // 다시 누르면 닫힌다
    await wallet.click();
    await expect(panel(page)).toBeVisible();
    await wallet.click();
    await expect(panel(page)).toHaveCount(0);

    const write = town(page).locator("[data-town-write]");
    await expect(write).toHaveAttribute("href", "/write");
    await expect(write).toHaveAttribute("data-write-progress", "0/3");
    await expect(write).toHaveAccessibleName("글쓰기, 오늘 글 보상 0/3");
    // 오늘 글 보상 하나 (원장 reason='post') → 창 하나에 불
    await sql`insert into point_ledger (user_id, reason, exp_delta, coin_delta) values (${await userId(username)}, 'post', 0, 1)`;
    await openTown(page);
    await expect(write).toHaveAttribute("data-write-progress", "1/3");
    await expect(write.locator("[data-lit]")).toHaveCount(1);
    await drawer(page).getByRole("tab", { name: /오늘 할 일/ }).click();
    const post = drawer(page).locator('[data-task="post"]');
    await expect(post).toHaveAttribute("data-done", "1");
    await expect(post).toContainText("글 보상 1/3");

    const guest = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await openTown(guest);
    await expect(town(guest).locator("[data-town-write]")).toHaveAttribute("data-town-write", "guest");
    await expect(town(guest).getByRole("link", { name: "✏️ 가입하고 글쓰기" })).toHaveAttribute("href", "/");
    await expect(town(guest).locator("[data-town-wallet]")).toHaveCount(0);
    await expect(drawer(guest).getByRole("heading", { name: "마을 소식" })).toBeVisible();
    await expect(drawer(guest).getByRole("tab")).toHaveCount(0);
    await guest.close();
  });

  test("광장 소식 서랍: 1440px은 펼치고 1280px은 접힌 탭, 고른 것은 기억한다. 즐겨찾는 이웃의 새 글은 그 글로, 없으면 마을 소식", async ({ page, browser }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const username = await signUpOk(page);
    const other = await browser.newPage();
    const neighbor = await signUpOk(other);
    await other.close();

    // 이웃이 없으면 마을 전체 새 글과 마을 소식·인기 글로 가는 길
    await openTown(page);
    await expect(drawer(page)).toHaveAttribute("data-open", "auto");
    const news = drawer(page).locator("[data-town-news]");
    await expect(news).toBeVisible();
    await expect(news).toHaveAttribute("data-town-news", "village");
    await expect(news.getByRole("link", { name: "📋 마을 소식" })).toHaveAttribute("href", "/feed");
    await expect(news.getByRole("link", { name: "🔥 인기 글" })).toHaveAttribute("href", "/popular");

    await sql`insert into follows (follower_id, followee_id, is_favorite)
      values (${await userId(username)}, ${await userId(neighbor)}, true)`;
    await insertPosts(neighbor, 2);
    const [latest] = await sql`select p.id from posts p join blogs b on b.id = p.blog_id join users u on u.id = b.owner_id
      where u.username = ${neighbor} order by p.created_at desc, p.id desc limit 1`;
    await openTown(page);
    await expect(news).toHaveAttribute("data-town-news", "neighbors");
    await expect(drawer(page).getByRole("tab", { name: /이웃 새 글/ })).toHaveAttribute("aria-selected", "true");
    const first = news.locator("[data-news-post]").first();
    await expect(first).toHaveAttribute("href", `/@${neighbor}/${latest.id}`);
    await expect(first).toContainText("글 2");
    await expect(first).toContainText("새 글,");
    await expect(news.locator("[data-news-post]")).toHaveCount(2);
    await expect(news.getByRole("link", { name: "이웃 새 글 모두 보기 ›" })).toHaveAttribute("href", "/feed/following");

    // 탭은 ←·→로 옮기고 게임은 걷지 않는다
    const before = await feet(page);
    await drawer(page).getByRole("tab", { name: /이웃 새 글/ }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(drawer(page).getByRole("tab", { name: /오늘 할 일/ })).toBeFocused();
    await expect(drawer(page).getByRole("tabpanel")).toHaveAttribute("data-drawer-panel", "tasks");
    expect(await feet(page)).toEqual(before);

    // 1280px: 처음에는 접힌 탭 하나
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(news).toBeHidden();
    const toggle = drawer(page).getByRole("button", { name: /^이웃 새 글 펼치기/ });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(drawer(page)).toHaveAttribute("data-open", "1");
    await expect(drawer(page).getByRole("tablist", { name: "광장 소식" })).toBeVisible();
    await openTown(page);
    await expect(drawer(page)).toHaveAttribute("data-open", "1");
    await expect(drawer(page).getByRole("tablist", { name: "광장 소식" })).toBeVisible();
    // 접으면 넓은 화면에서도 접힌 채
    await drawer(page).getByRole("button", { name: "광장 소식 접기" }).click();
    await expect(drawer(page)).toHaveAttribute("data-open", "0");
    await page.setViewportSize({ width: 1440, height: 900 });
    await openTown(page);
    await expect(drawer(page).getByRole("tablist")).toBeHidden();
    await expect(drawer(page).getByRole("button", { name: /^이웃 새 글 펼치기, 24시간 안에 쓴 글 2편$/ })).toBeVisible();
  });

  test("오늘 할 일: 출석은 이미 했고, [✨ 가기]는 그 장소 앞으로 텔레포트해 Space로 들어간다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signUpOk(page);
    await openTown(page);
    await drawer(page).getByRole("tab", { name: /오늘 할 일/ }).click();
    const tasks = drawer(page).getByRole("list", { name: "오늘 할 일" });
    await expect(tasks.locator("[data-task]")).toHaveCount(4);
    await expect(tasks.locator('[data-task="attendance"]')).toHaveAttribute("data-done", "1");
    await expect(tasks.locator('[data-task="attendance"]')).toContainText("한 일, 📮 출석 도장");
    await expect(tasks.locator('[data-task="fishing"]')).toHaveAttribute("data-done", "0");
    await expect(tasks.locator('[data-task="farm"]')).toContainText("돌보기 보상 0/15");
    await expect(tasks.locator('[data-task="post"]').getByRole("link", { name: "공개 글 쓰기: 글쓰기" })).toHaveAttribute("href", "/write");
    await expect(drawer(page).getByRole("tab", { name: /오늘 할 일/ })).toContainText("1/4");

    await tasks.getByRole("button", { name: "낚시 한 번: 🎣 낚시터 앞으로 텔레포트" }).click();
    await expect(prompt(page)).toHaveText("🎣 낚시터 · Space 들어가기");
    await page.keyboard.press("Space");
    await expect(page).toHaveURL("/fishing");
  });

  test("?from=shop은 상점 문 앞에서 시작, 모르는 값은 분수 아래. 장소 간판은 구역과 한국 시각", async ({ page }) => {
    await signUpOk(page);
    await openTown(page);
    const start = await feet(page);
    const sign = town(page).locator("[data-town-place]");
    await expect(sign).toHaveAttribute("data-town-place", "plaza");
    await expect(sign).toContainText("중앙 광장");
    await expect(sign.locator("[data-town-clock]")).toHaveText(/^(새벽|낮|노을|밤) ([1-9]|1[0-2]):[0-5]\d$/);

    await openTown(page, "/town?from=shop");
    await expect(prompt(page)).toHaveText("🏪 상점 · Space 들어가기");
    expect(await feet(page)).toEqual([1400, 800]);
    await openTown(page, "/town?from=nope");
    expect(await feet(page)).toEqual(start);
    // 하늘을 고정하면 시계 이름도 그것
    await openTown(page, "/town?sky=night");
    await expect(sign.locator("[data-town-clock]")).toHaveText(/^밤 /);
  });

  test("안 읽은 알림은 탭으로 돌아오면 다시 읽어 ☰ 숫자를 바꾸고 bv-mail을 보낸다. ☰에 업데이트 소식과 화면 설정", async ({ page }) => {
    const username = await signUpOk(page);
    await insertPosts(username, 1);
    await openTown(page);
    const menu = town(page).locator("[data-town-menu]");
    await expect(menu).toHaveText("☰ 메뉴");
    await page.evaluate(() => {
      const w = window as unknown as { mail: boolean[] };
      w.mail = [];
      window.addEventListener("bv-mail", (e) => w.mail.push((e as CustomEvent<{ flag: boolean }>).detail.flag));
    });
    const [{ id: actorId }] = await sql`select id from users where username <> ${username} limit 1`;
    const [post] = await sql`select p.id from posts p join blogs b on b.id = p.blog_id join users u on u.id = b.owner_id where u.username = ${username} limit 1`;
    await sql`insert into notifications (user_id, kind, actor_id, post_id) values (${await userId(username)}, 'comment', ${actorId}, ${post.id})`;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(menu).toHaveText("☰ 메뉴1");
    await expect.poll(() => page.evaluate(() => (window as unknown as { mail: boolean[] }).mail)).toEqual([true]);

    await menu.click();
    await expect(panel(page).getByRole("button", { name: /🔔 알림/ })).toContainText("안 읽은 알림 1개");
    await expect(panel(page).getByRole("link", { name: "🆕 업데이트 소식" })).toHaveAttribute("href", "/updates");
    await expect(panel(page).locator("[data-town-theme]")).toBeVisible();
    await expect(panel(page).locator("[data-theme-toggle]")).toHaveCount(0);
  });
});
