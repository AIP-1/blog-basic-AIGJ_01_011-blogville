import { expect, test, type Page } from "./fixtures";

// 🗺 맛집 지도: 카카오맵·네이버 지도 SDK는 시험에서 부르지 않는다 — 브라우저가 받는 SDK 주소를 작은 가짜 SDK로 바꿔
// 핀·내 위치·말풍선·[지도에서 보기]·[이 지역에서 다시 찾기]가 화면과 이어지는지만 본다.
// 시험 서버에 열쇠(KAKAO_REST_API_KEY·KAKAO_JS_KEY)가 없으면 지도도 없다 — 그때는 건너뛴다.
const FAKE_SDK = `
window.kakao = { maps: {
  load(cb) { cb(); },
  LatLng: class { constructor(a, b) { this.a = a; this.b = b; } getLat() { return this.a; } getLng() { return this.b; } },
  LatLngBounds: class { extend() {} },
  ZoomControl: class {}, ControlPosition: { RIGHT: 1 },
  Map: class { constructor(el, o) { this.el = el; this.c = o.center; window.__map = this; } addControl() {} setBounds() {} panTo(p) { this.c = p; } getCenter() { return this.c; } },
  CustomOverlay: class { constructor(o = {}) { Object.assign(this, o); if (o.map) this.setMap(o.map); } setContent(c) { this.content = c; } setPosition(p) { this.position = p; }
    setMap(m) { if (this.el) this.el.remove(); this.el = null; if (m && this.content) { this.el = this.content; m.el.appendChild(this.el); } } },
  event: { addListener(map, name, fn) { (map.handlers ||= {})[name] = fn; } },
} };`;

// 네이버 지도 v3 가짜 (Marker의 icon.content를 지도 칸에 붙이고, Event.addListener로 누름을 잇는다)
const FAKE_NAVER = `
window.naver = { maps: {
  LatLng: class { constructor(a, b) { this.a = a; this.b = b; } lat() { return this.a; } lng() { return this.b; } },
  LatLngBounds: class { constructor() {} extend() {} },
  Point: class { constructor(x, y) { this.x = x; this.y = y; } },
  Position: { RIGHT_CENTER: 1 },
  Map: class { constructor(el, o) { this.el = el; this.c = o.center; window.__map = this; } fitBounds() {} panTo(p) { this.c = p; } getCenter() { return this.c; } },
  Marker: class { constructor(o) { this.el = o.icon.content; o.map.el.appendChild(this.el); } setMap(m) { if (!m) this.el.remove(); } },
  InfoWindow: class { constructor() {} setContent(c) { this.c = c; } open(map) { if (this.el) this.el.remove(); this.el = this.c; map.el.appendChild(this.el); } close() { if (this.el) this.el.remove(); this.el = null; } },
  Event: { once(t, name, fn) { if (name === "init" && !window.__naverNoInit) setTimeout(fn, 0); }, addListener(t, name, fn) { (t.handlers ||= {})[name] = fn; if (t.el && name === "click" && !(t instanceof window.naver.maps.Map)) t.el.addEventListener("click", fn); } },
} };`;

async function fakeKakao(page: Page) {
  await page.route("https://dapi.kakao.com/v2/maps/sdk.js**", (route) => route.fulfill({ contentType: "text/javascript", body: FAKE_SDK }));
  await page.route("https://oapi.map.naver.com/openapi/v3/maps.js**", (route) => route.fulfill({ contentType: "text/javascript", body: FAKE_NAVER }));
}

test("내 주변: 지도에 내 위치와 번호 핀, 핀·[지도에서 보기]로 말풍선, 지도를 옮기면 [이 지역에서 다시 찾기]", async ({ page }) => {
  await fakeKakao(page);
  await page.goto("/food?tab=near&lat=35.147&lng=126.915");
  const map = page.locator("[data-food-map]");
  test.skip((await map.count()) === 0, "열쇠가 없는 시험 서버");
  await expect(map).toHaveAttribute("data-food-map", "ready");
  await expect(map.locator(".food-map-me")).toHaveCount(1);
  const pins = map.locator("[data-food-pin]");
  const n = await page.locator('[data-food-list="near"] > li').count();
  await expect(pins).toHaveCount(n);
  await expect(pins.first()).toHaveText("1");

  await pins.nth(1).click();
  await expect(map.locator(".food-map-info")).toContainText("2.");
  const second = page.locator('[data-food-list="near"] > li').nth(2);
  await second.locator("[data-food-focus]").click();
  await expect(map.locator(".food-map-info")).toContainText("3.");
  // 말풍선에 네이버 지도·카카오맵 둘 다 (새 탭)
  await expect(map.locator(".food-map-info a")).toHaveText(["네이버 지도 ›", "카카오맵 ›"]);
  for (const a of await map.locator(".food-map-info a").all()) await expect(a).toHaveAttribute("target", "_blank");

  // 지도를 옮기면(드래그 끝) 다시 찾기 → 지도 가운데 좌표로
  await page.evaluate(() => {
    const m = (window as unknown as { __map: { c: unknown; handlers: Record<string, () => void> } }).__map;
    const w = window as unknown as { kakao?: { maps: { LatLng: new (a: number, b: number) => unknown } }; naver?: { maps: { LatLng: new (a: number, b: number) => unknown } } };
    m.c = new (w.naver ?? w.kakao)!.maps.LatLng(35.16, 126.85);
    m.handlers.dragend();
  });
  await page.locator("[data-food-research]").click();
  await expect(page).toHaveURL(/\/food\?tab=near&lat=35\.160&lng=126\.850$/);
});

test("네이버 지도 인증이 실패하면 카카오맵으로 바꿔 보여 준다", async ({ page }) => {
  await page.route("https://dapi.kakao.com/v2/maps/sdk.js**", (route) => route.fulfill({ contentType: "text/javascript", body: FAKE_SDK }));
  // 네이버는 지도를 그린 뒤 인증 실패를 알린다
  await page.route("https://oapi.map.naver.com/openapi/v3/maps.js**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: `${FAKE_NAVER}; setTimeout(() => window.navermap_authFailure && window.navermap_authFailure(), 300);` }),
  );
  await page.goto("/food?tab=near&lat=35.147&lng=126.915");
  const map = page.locator("[data-food-map]");
  test.skip((await map.count()) === 0, "열쇠가 없는 시험 서버");
  await expect(map).toHaveAttribute("data-food-map", "ready");
  await expect.poll(() => page.evaluate(() => !!(window as unknown as { kakao?: unknown }).kakao)).toBe(true);
  await expect(map).toHaveAttribute("data-food-map", "ready");
  await expect(map.locator("[data-food-pin]")).toHaveCount(await page.locator('[data-food-list="near"] > li').count());
});

test("네이버 지도가 인증 실패 그림만 깔고 아무 소식이 없어도 6초 뒤 카카오맵으로", async ({ page }) => {
  await page.route("https://dapi.kakao.com/v2/maps/sdk.js**", (route) => route.fulfill({ contentType: "text/javascript", body: FAKE_SDK }));
  await page.route("https://oapi.map.naver.com/openapi/v3/maps.js**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: `window.__naverNoInit = true; ${FAKE_NAVER}` }),
  );
  await page.goto("/food?tab=near&lat=35.147&lng=126.915");
  const map = page.locator("[data-food-map]");
  test.skip((await map.count()) === 0, "열쇠가 없는 시험 서버");
  await expect.poll(() => page.evaluate(() => !!(window as unknown as { kakao?: unknown }).kakao), { timeout: 10_000 }).toBe(true);
  await expect(map).toHaveAttribute("data-food-map", "ready");
  await expect(map.locator("[data-food-pin]")).toHaveCount(await page.locator('[data-food-list="near"] > li').count());
});

test("지도 고르기: 열쇠가 둘 다 있으면 [네이버 | 카카오]로 바꾸고, 고른 지도를 다음에도 연다", async ({ page }) => {
  await fakeKakao(page);
  await page.goto("/food?tab=near&lat=35.147&lng=126.915");
  const picks = page.locator("[data-food-map-pick]");
  test.skip((await picks.count()) < 2, "지도 열쇠가 둘 다 있는 시험 서버에서만");
  const map = page.locator("[data-food-map]");
  await expect(map).toHaveAttribute("data-food-map", "ready");
  await expect(page.locator('[data-food-map-pick="naver"]')).toHaveAttribute("aria-pressed", "true");

  await page.locator('[data-food-map-pick="kakao"]').click();
  await expect(page.locator('[data-food-map-pick="kakao"]')).toHaveAttribute("aria-pressed", "true");
  await expect(map).toHaveAttribute("data-food-map", "ready");
  await expect(map.locator("[data-food-pin]").first()).toHaveText("1");

  await page.reload();
  await expect(page.locator('[data-food-map-pick="kakao"]')).toHaveAttribute("aria-pressed", "true");
});
