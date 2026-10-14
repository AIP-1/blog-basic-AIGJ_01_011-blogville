import { expect, test } from "./fixtures";
import { signUpOk, sql, writePost } from "./helpers";

// 🧩 위젯보드: 블로그 관리에서 옆 칸 위젯의 순서·보이기·크기를 바꾸면 블로그 홈 옆 칸이 그대로 따른다.
// 📅 캘린더(글 쓴 날 점 → 누르면 그날 글), 🌤️ 날씨(바깥 서비스라 시험은 가짜 응답), 👣 방문자 7일 그래프.
test.describe.configure({ timeout: 60_000 });

const slots = (page: import("@playwright/test").Page) => page.locator("[data-sidebar] > [data-widget-slot]");

test("위젯 순서를 ▲▼·끌어 놓기로 바꾸고 숨기고 크기를 고르면 옆 칸이 따르고, 기본 배치로 되돌릴 수 있다", async ({ page, browser }) => {
  const me = await signUpOk(page);
  await page.goto("/settings/blog");
  const card = page.locator("#widgets");
  const rows = card.locator("[data-widget-row]");
  await expect(rows.first()).toHaveAttribute("data-widget-row", "guestbook");

  // 🏷 태그를 ▲로 맨 위까지
  for (let i = 0; i < 20 && (await rows.first().getAttribute("data-widget-row")) !== "tags"; i++) {
    await card.getByRole("button", { name: "태그 위로" }).click();
  }
  await expect(rows.first()).toHaveAttribute("data-widget-row", "tags");
  // 📡 RSS를 끌어서 두 번째(📖 방명록 자리)로
  // (목록 전체가 한 화면에 들어오게 해서 마우스로 끈다)
  await page.setViewportSize({ width: 1280, height: 2400 });
  const from = (await card.locator('[data-widget-row="rss"]').boundingBox())!;
  const to = (await card.locator('[data-widget-row="guestbook"]').boundingBox())!;
  await page.mouse.move(from.x + 20, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + 20, to.y + to.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(rows.nth(1)).toHaveAttribute("data-widget-row", "rss");
  // 🔍 블로그 검색 숨기기, 📝 최근 글 작게, 👣 방문자 크게(기본)
  await card.locator('[data-widget-row="search"]').getByLabel("보이기").uncheck();
  await card.getByRole("group", { name: "최근 글 크기" }).getByRole("button", { name: "작게" }).click();
  await card.getByRole("combobox").selectOption("busan");
  await card.getByRole("button", { name: "위젯 배치 저장" }).click();
  await expect(card.getByRole("status")).toHaveText("위젯 배치를 저장했어요");

  const [{ layout }] = await sql`select widget_layout as layout from blogs where slug = ${me}`;
  expect(layout.items[0]).toEqual({ key: "tags", visible: true, size: "lg" });
  expect(layout.weather).toEqual({ city: "busan" });

  // 방문자가 보는 옆 칸
  const visitor = await browser.newPage();
  await visitor.route("**/api/weather?**", (route) => route.fulfill({ status: 502, json: { error: "unavailable" } }));
  await visitor.goto(`/@${me}`);
  await expect(slots(visitor).first()).toHaveAttribute("data-widget-slot", "tags");
  await expect(slots(visitor).nth(1)).toHaveAttribute("data-widget-slot", "rss");
  await expect(visitor.locator('[data-widget-slot="search"]')).toHaveCount(0);
  await expect(visitor.locator('[data-widget-slot="recent"]')).toHaveAttribute("data-size", "sm");
  // 마을 검색은 주인에게만, 종목이 없으면 방문자에게 📈 칸이 보이지 않는다
  await expect(visitor.locator('[data-widget-slot="town"]')).toHaveCount(0);
  await expect(visitor.locator('[data-widget-slot="stocks"]')).toBeHidden();
  // 👣 크게 = 최근 7일 막대
  await expect(visitor.locator("[data-visit-days] li")).toHaveCount(7);

  // 기본 배치로
  await page.goto("/settings/blog");
  await card.getByRole("button", { name: "기본 배치로" }).click();
  await expect(card.getByRole("status")).toHaveText("기본 배치로 되돌렸어요");
  await expect(rows.first()).toHaveAttribute("data-widget-row", "guestbook");
  const [{ layout: reset }] = await sql`select widget_layout as layout from blogs where slug = ${me}`;
  expect(reset).toBeNull();
});

test("📅 캘린더: 오늘 쓴 글이 점으로 보이고 누르면 그날 글 목록, 이전 달로 넘길 수 있다. 작게면 이번 주", async ({ page, browser }) => {
  const me = await signUpOk(page);
  await writePost(page, "달력에 보일 글", "본문");
  await writePost(page, "비공개 글", "본문", { private: true });
  const visitor = await browser.newPage();
  await visitor.goto(`/@${me}`);
  const cal = visitor.locator('[data-widget="calendar"]');
  const today = cal.getByRole("button", { name: /, 오늘$/ });
  await expect(today).toHaveAccessibleName(/글 1개, 오늘$/);
  await today.click();
  await expect(cal.locator("[data-calendar-posts]")).toContainText("달력에 보일 글");
  await expect(cal.locator("[data-calendar-posts]")).not.toContainText("비공개 글");
  await cal.locator("[data-calendar-posts]").getByRole("link", { name: "달력에 보일 글" }).click();
  await expect(visitor.getByRole("heading", { level: 1, name: "달력에 보일 글" })).toBeVisible();

  await visitor.goto(`/@${me}`);
  const title = await cal.locator("#w-calendar").textContent();
  await cal.getByRole("button", { name: "이전 달" }).click();
  await expect(cal.locator("#w-calendar")).not.toHaveText(title ?? "");
  await expect(cal.locator("[data-has-posts]")).toHaveCount(0);
  await cal.getByRole("button", { name: "오늘" }).click();
  await expect(cal.locator("[data-has-posts]")).toHaveCount(1);

  // 이상한 달·없는 블로그
  expect((await visitor.request.get(`/api/blogs/${me}/calendar?month=2026-13`)).status()).toBe(400);
  expect((await visitor.request.get(`/api/blogs/zz_no_blog_zz/calendar?month=2026-10`)).status()).toBe(404);

  // 작게 = 이번 주 7칸
  await sql`update blogs set widget_layout = ${sql.json({ items: [{ key: "calendar", visible: true, size: "sm" }] })} where slug = ${me}`;
  await visitor.goto(`/@${me}`);
  await expect(cal.getByRole("gridcell")).toHaveCount(7);
  await expect(cal.getByRole("button", { name: /, 오늘$/ })).toBeVisible();
});

test("🌤️ 날씨: 기본 도시 → 📍 내 위치를 누르면 그 위치 7일 예보, 기본 도시로 돌아갈 수 있다", async ({ page, browser }) => {
  const me = await signUpOk(page);
  await sql`update blogs set widget_layout = ${sql.json({ items: [{ key: "weather", visible: true, size: "lg" }] })} where slug = ${me}`;
  const context = await browser.newContext({ geolocation: { latitude: 35.1796, longitude: 129.0756 }, permissions: ["geolocation"], locale: "ko-KR" });
  const visitor = await context.newPage();
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.now() + 9 * 3_600_000 + i * 86_400_000).toISOString().slice(0, 10));
  await visitor.route("**/api/weather?**", (route) => {
    const mine = route.request().url().includes("lat=");
    return route.fulfill({
      json: {
        place: mine ? "해운대구" : "서울",
        now: { temp: mine ? 21 : 15, code: mine ? 0 : 3 },
        days: days.map((date, i) => ({ date, code: 61, max: 20 + i, min: 10 + i, rain: 40 })),
      },
    });
  });
  await visitor.goto(`/@${me}`);
  const w = visitor.locator('[data-widget="weather"]');
  await expect(w).toBeVisible();
  await w.getByRole("button", { name: "📍 내 위치" }).click();
  await expect(w.locator("[data-weather-place]")).toContainText("해운대구");
  await expect(w.locator("[data-weather-now]")).toHaveText("21°");
  await expect(w.getByRole("list", { name: "7일 예보" }).getByRole("listitem")).toHaveCount(7);
  // 다시 와도 내 위치 그대로 (이 브라우저에 기억)
  await visitor.reload();
  await expect(w.locator("[data-weather-place]")).toContainText("해운대구");
  await w.getByRole("button", { name: "기본 도시로" }).click();
  await expect(w.locator("[data-weather-place]")).toContainText("서울");
  // 이상한 값은 400
  expect((await visitor.request.get("/api/weather?city=tokyo")).status()).toBe(400);
  expect((await visitor.request.get("/api/weather?lat=999&lon=1")).status()).toBe(400);
  await context.close();
});
