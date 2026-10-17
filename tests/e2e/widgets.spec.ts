import { expect, test } from "./fixtures";
import { signUpOk, sql } from "./helpers";

// 🧩 위젯보드: 블로그 관리에서 옆 칸 위젯의 순서·보이기·크기를 바꾸면 블로그 홈 옆 칸이 그대로 따른다.
// 👣 방문자 7일 그래프. (☀️ 날씨·📅 캘린더 화면은 weather-calendar.spec.ts)
test.describe.configure({ timeout: 60_000 });

// 넓은 화면에서는 옆 칸이 두 줄(앞 줄·뒤 줄)로 나뉘어 한 겹 안에 있다. 순서는 그대로
const slots = (page: import("@playwright/test").Page) => page.locator("[data-sidebar] [data-widget-slot]");

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
  await card.getByRole("button", { name: "위젯 배치 저장" }).click();
  await expect(card.getByRole("status")).toHaveText("위젯 배치를 저장했어요");

  const [{ layout }] = await sql`select widget_layout as layout from blogs where slug = ${me}`;
  expect(layout.items[0]).toEqual({ key: "tags", visible: true, size: "lg" });

  // 방문자가 보는 옆 칸
  const visitor = await browser.newPage();
  await visitor.route("**/api/weather?**", (route) => route.fulfill({ status: 502, json: { error: "unavailable" } }));
  await visitor.goto(`/@${me}`);
  await expect(slots(visitor).first()).toHaveAttribute("data-widget-slot", "tags");
  await expect(slots(visitor).nth(1)).toHaveAttribute("data-widget-slot", "rss");
  await expect(visitor.locator('[data-widget-slot="search"]')).toHaveCount(0);
  await expect(visitor.locator('[data-widget-slot="recent"]')).toHaveAttribute("data-size", "sm");
  // 마을 검색은 주인에게만, 📈 증시는 종목이 없어도 지수가 보인다
  await expect(visitor.locator('[data-widget-slot="town"]')).toHaveCount(0);
  await expect(visitor.locator('[data-widget-slot="stocks"]')).toBeVisible();
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
