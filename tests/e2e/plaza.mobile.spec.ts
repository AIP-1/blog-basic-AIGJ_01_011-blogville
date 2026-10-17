import { expect, test } from "./fixtures";
import { insertPosts, signUpOk, sql } from "./helpers";

// 휴대폰 광장 (광장 개편, TOWN-01 결정 변경 · PHONE_PLAZA): 640px 미만 회원의 /town은 게임 대신 세로 광장.
// 마을 그림 → ✏️ 글쓰기 → 이웃 새 글 → 오늘 할 일 → 마을 장소 3×2 → 내 우체통. 아래 탭 🏘 마을이 /town.
test.describe.configure({ timeout: 120_000 });

const userId = async (username: string) => (await sql`select id from users where username = ${username}`)[0].id as string;

test.describe("휴대폰 광장", () => {
  test("회원의 /town: 마을 그림·글쓰기·이웃 새 글·오늘 할 일·장소 6곳·내 우체통, 🏘 마을 탭이 켜지고 가로 스크롤이 없다", async ({ page, browser }) => {
    const username = await signUpOk(page);
    const other = await browser.newPage();
    const neighbor = await signUpOk(other);
    await other.close();
    await sql`insert into follows (follower_id, followee_id, is_favorite)
      values (${await userId(username)}, ${await userId(neighbor)}, true)`;
    await insertPosts(neighbor, 1);

    await page.goto("/town");
    await expect(page).toHaveURL("/town");
    const plaza = page.locator("[data-phone-plaza]");
    await expect(plaza).toBeVisible();
    await expect(page.locator("[data-town]")).toBeHidden();
    await expect(plaza.getByRole("heading", { name: `${username}님의 마을` })).toBeVisible();
    await expect(plaza.locator("[data-village-diorama]")).toHaveAttribute("data-village-diorama", "2");
    await expect(plaza.getByRole("img", { name: `${username}님의 마을` })).toBeAttached();
    // 이웃이 글을 써서 그 집에 불이 켜졌다
    await expect(plaza.locator("[data-plaza-lit]")).toHaveText("불 켜진 집 1채");

    const write = plaza.locator("[data-town-write]");
    await expect(write).toHaveAttribute("href", "/write");
    await expect(write).toHaveAttribute("data-write-progress", "0/3");

    await expect(plaza.getByRole("heading", { name: "이웃 새 글" })).toBeVisible();
    const news = plaza.locator('[data-town-news="neighbors"]');
    await expect(news.locator("[data-news-post]")).toHaveCount(1);
    await expect(news.locator("[data-news-post]")).toHaveAttribute("href", new RegExp(`^/@${neighbor}/\\d+$`));

    const tasks = plaza.getByRole("list", { name: "오늘 할 일" });
    await expect(tasks.locator("[data-task]")).toHaveCount(4);
    // 휴대폰은 텔레포트 없이 그 화면으로
    await expect(tasks.getByRole("button")).toHaveCount(0);
    await expect(tasks.locator('[data-task="fishing"]').getByRole("link")).toHaveAttribute("href", "/fishing");

    const places = plaza.getByRole("navigation", { name: "마을 장소" }).getByRole("link");
    await expect(places).toHaveText(["🏪 상점", "👗 옷가게", "💇 미용실", "📮 출석", "🐮 동물 농장", "🎣 낚시터"]);
    for (const link of await places.all()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    await expect(plaza.getByRole("heading", { name: /📮 내 우체통/ })).toBeVisible();
    await expect(plaza).toContainText("아직 알림이 없어요.");
    await expect(plaza.getByRole("link", { name: "알림함 전체 보기 ›" })).toHaveAttribute("href", "/notifications");

    const tabs = page.getByRole("navigation", { name: "아래 탭" });
    await expect(tabs.getByRole("link", { name: "마을", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(tabs.getByRole("link", { name: "메뉴" })).not.toHaveAttribute("aria-current", "page");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

    // 숨은 PC HUD는 휴대폰에서 안 읽은 알림 수를 다시 읽지 않는다 (탭으로 돌아와도. 헤더 🔔은 주소가 바뀔 때만 읽는다)
    const polls: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/notifications/unread")) polls.push(r.url());
    });
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await page.waitForTimeout(500);
    expect(polls).toEqual([]);

    // 장소를 누르면 그 화면
    await places.filter({ hasText: "낚시터" }).click();
    await expect(page).toHaveURL("/fishing");
  });

  test("이웃 글이 없으면 마을 소식, 방문자는 예전 간단 메뉴", async ({ page, browser }) => {
    await signUpOk(page);
    await page.goto("/town");
    const plaza = page.locator("[data-phone-plaza]");
    await expect(plaza.getByRole("heading", { name: "📋 마을 소식" })).toBeVisible();
    const news = plaza.locator('[data-town-news="village"]');
    await expect(news.getByRole("link", { name: "📋 마을 소식" })).toHaveAttribute("href", "/feed");
    await expect(news.getByRole("link", { name: "🔥 인기 글" })).toHaveAttribute("href", "/popular");
    expect(await news.locator("[data-news-post]").count()).toBeLessThanOrEqual(4);

    const guest = await browser.newPage({ viewport: { width: 375, height: 812 } });
    await guest.goto("/town");
    await expect(guest.getByRole("heading", { name: "🏘 Blogville 마을 구경" })).toBeVisible();
    await expect(guest.locator("[data-phone-plaza]")).toHaveCount(0);
    await guest.close();
  });
});
