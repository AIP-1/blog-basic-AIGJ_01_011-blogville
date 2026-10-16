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

test("📍 내 위치 날씨: 허락하면 그 자리, 다음에 와도 기억한 자리로 그린다(Safari처럼 다시 묻는 브라우저), 끄면 블로그 도시", async ({ page, browser }) => {
  const me = await signUpOk(page);
  const context = await browser.newContext({ geolocation: { latitude: 35.16, longitude: 129.06 }, permissions: ["geolocation"] });
  const visitor = await context.newPage();
  const asked: string[] = [];
  await visitor.route("**/api/weather?**", (route) => {
    asked.push(new URL(route.request().url()).search);
    return route.fulfill({ json: WEATHER });
  });
  await visitor.goto(`/@${me}`);
  const weather = visitor.locator("[data-weather-widget]");
  await expect(weather.locator("[data-weather-temp]")).toHaveText("15.9°");
  await weather.getByRole("button", { name: "📍 내 위치 날씨" }).click();
  await expect(weather.locator("[data-weather-place]")).toHaveText("📍 내 위치");
  await expect.poll(() => asked.at(-1)).toBe("?lat=35.2&lon=129.1");

  // 허락이 풀린 다음 방문 (Safari 기본 "묻기"): 기억한 자리로 바로
  await context.clearPermissions();
  await visitor.reload();
  await expect(weather.locator("[data-weather-place]")).toHaveText("📍 내 위치");
  await expect.poll(() => asked.at(-1)).toBe("?lat=35.2&lon=129.1");

  // 블로그 도시로 돌아가면 잊는다
  await weather.getByRole("button", { name: "서울 날씨 보기" }).click();
  await visitor.reload();
  await expect(weather.locator("[data-weather-place]")).toHaveText("서울");
  await context.close();
});

test("📍 내 위치 날씨: 권한이 꺼져 있으면 켜는 방법을 알려 준다", async ({ page, browser }) => {
  const me = await signUpOk(page);
  const context = await browser.newContext({ permissions: [] });
  const visitor = await context.newPage();
  await visitor.route("**/api/weather?**", (route) => route.fulfill({ json: WEATHER }));
  await visitor.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_ok, fail) => fail?.({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
  });
  await visitor.goto(`/@${me}`);
  const weather = visitor.locator("[data-weather-widget]");
  await weather.getByRole("button", { name: "📍 내 위치 날씨" }).click();
  await expect(weather.getByRole("status")).toContainText("위치 권한이 꺼져 있어요");
  await expect(weather.locator("[data-weather-place]")).toHaveText("서울");
  await context.close();
});

test("서버가 미세먼지를 못 받아 오면 브라우저가 직접 받아 채운다", async ({ page }) => {
  const me = await signUpOk(page);
  await page.route("**/api/weather?**", (route) => route.fulfill({ json: { ...WEATHER, weather: { ...WEATHER.weather, pm10: null, pm25: null } } }));
  await page.route("https://air-quality-api.open-meteo.com/**", (route) =>
    route.fulfill({ json: { current: { pm10: 95, pm2_5: 20 } }, headers: { "Access-Control-Allow-Origin": "*" } }),
  );
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto(`/@${me}`);
  const weather = page.locator("[data-weather-widget]");
  await expect(weather.locator("[data-weather-temp]")).toHaveText("15.9°");
  await expect(weather).toContainText("미세 나쁨");
});
