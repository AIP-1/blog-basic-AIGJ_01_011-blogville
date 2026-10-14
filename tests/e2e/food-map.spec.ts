import { expect, test, type Page } from "./fixtures";

// 🗺 맛집 지도: 카카오맵 JavaScript SDK는 시험에서 부르지 않는다 — 브라우저가 받는 SDK 주소를 작은 가짜 SDK로 바꿔
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

async function fakeKakao(page: Page) {
  await page.route("https://dapi.kakao.com/v2/maps/sdk.js**", (route) => route.fulfill({ contentType: "text/javascript", body: FAKE_SDK }));
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
  await expect(map.locator(".food-map-info a")).toHaveAttribute("target", "_blank");

  // 지도를 옮기면(드래그 끝) 다시 찾기 → 지도 가운데 좌표로
  await page.evaluate(() => {
    const m = (window as unknown as { __map: { c: unknown; handlers: Record<string, () => void> } }).__map;
    m.c = new (window as unknown as { kakao: { maps: { LatLng: new (a: number, b: number) => unknown } } }).kakao.maps.LatLng(35.16, 126.85);
    m.handlers.dragend();
  });
  await page.locator("[data-food-research]").click();
  await expect(page).toHaveURL(/\/food\?tab=near&lat=35\.160&lng=126\.850$/);
});
