import { expect, test } from "./fixtures";
import { signUpOk, sql } from "./helpers";

// ☀️ 날씨·📅 캘린더 위젯 화면 (블로그 홈 위젯 보드). Open-Meteo는 부르지 않는다 — 브라우저가 부르는 /api/weather를 가짜 응답으로 바꾼다.
test.describe.configure({ timeout: 90_000 });

const hours = Array.from({ length: 5 }, (_, i) => `2026-10-14T${String(11 + i * 2).padStart(2, "0")}:00`);
const WEATHER = {
  place: { name: "서울", city: "seoul" },
  weather: {
    time: "2026-10-14T11:00", temp: 15.9, code: 0, isDay: true, min: 9, max: 20, pm10: 45, pm25: 12,
    hours: hours.map((time, i) => ({ time, temp: [17, 20, 20, 18, 15][i], code: 0, isDay: i < 4 })),
    days: ["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"].map((date, i) => ({
      date, code: [0, 2, 3, 61, 80, 1, 95][i], max: 20 - i, min: 9 - i, rain: [0, 10, 20, 80, 60, 0, 90][i],
    })),
  },
};

test("날씨·캘린더 위젯", async ({ page, browser }) => {
  const me = await signUpOk(page);
  const [blog] = await sql`select b.id from blogs b join users u on u.id = b.owner_id where u.username = ${me}`;
  await sql`insert into posts (blog_id, title, content_html, content_text, is_public, created_at) values
    (${blog.id}, '오늘 쓴 글', '<p>a</p>', 'a', true, now()),
    (${blog.id}, '지난달 글', '<p>b</p>', 'b', true, date_trunc('month', now()) - interval '2 days'),
    (${blog.id}, '비밀 글', '<p>c</p>', 'c', false, now())`;
  const asked: string[] = [];
  await page.route("**/api/weather?**", (route) => {
    asked.push(new URL(route.request().url()).search);
    return route.fulfill({ json: WEATHER });
  });
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto(`/@${me}`);
  const weather = page.locator("[data-weather-widget]");
  await expect(weather.locator("[data-weather-temp]")).toHaveText("15.9°");
  await expect(weather.locator("[data-weather-day]")).toHaveCount(7);
  await expect(weather.locator("[data-weather-hour]")).toHaveCount(5);
  await expect(weather).toContainText("미세 보통");
  const cal = page.locator("[data-calendar-widget]");
  await expect(cal.locator("[data-has-posts]")).toHaveCount(1);
  await expect(cal.locator("[data-calendar-posts]")).toContainText("오늘 쓴 글");
  await expect(cal.locator("[data-calendar-posts]")).toContainText("비밀 글");

  // 주인은 도시를 바꾼다
  await weather.getByLabel("블로그 도시").selectOption("busan");
  await expect(weather.getByRole("status")).toContainText("부산");
  await expect.poll(() => asked.at(-1)).toBe("?city=busan");

  // 방문자: 비밀 글은 안 보이고, 지난달로 넘기면 그 달 글
  const visitor = await browser.newPage({ viewport: { width: 375, height: 900 } });
  await visitor.route("**/api/weather?**", (route) => route.fulfill({ json: { ...WEATHER, place: { name: "부산", city: "busan" } } }));
  await visitor.goto(`/@${me}`);
  const vcal = visitor.locator("[data-calendar-widget]");
  await expect(vcal.locator("[data-calendar-posts]")).toContainText("오늘 쓴 글");
  await expect(vcal.locator("[data-calendar-posts]")).not.toContainText("비밀 글");
  await expect(visitor.locator("[data-weather-place]")).toHaveText("부산");
  await expect(visitor.locator("[data-weather-widget]").getByLabel("블로그 도시")).toHaveCount(0);
  await vcal.getByRole("button", { name: "이전 달" }).click();
  await expect(vcal.locator("[data-has-posts]")).toHaveCount(1);
  await vcal.locator("[data-has-posts]").click();
  await expect(vcal.locator("[data-calendar-posts]")).toContainText("지난달 글");

});
