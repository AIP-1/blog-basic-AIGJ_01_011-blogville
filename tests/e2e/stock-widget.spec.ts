import { expect, test } from "./fixtures";
import { signUpOk } from "./helpers";

// 📈 관심 종목: 블로그 설정에서 찾아 넣고 빼고, 블로그 홈 옆 칸에서 실시간 스트림(SSE)으로 시세가 바뀐다.
// 네이버 증권은 시험에서 부르지 않는다 — 브라우저가 부르는 검색·시세 주소를 가짜 응답으로 바꾼다.
test.describe.configure({ timeout: 60_000 });

const SAMSUNG = { market: "KR", code: "005930", name: "삼성전자" };
const APPLE = { market: "US", code: "AAPL.O", name: "애플" };

test("종목을 찾아 넣으면 옆 칸에 보이고 실시간 스트림으로 시세가 바뀌며, 빼면 사라진다", async ({ page, browser }) => {
  const me = await signUpOk(page);

  // 종목이 없으면 주인에게만 안내, 방문자에게는 지수만
  await page.goto(`/@${me}`);
  await expect(page.locator("[data-stock-widget]")).toContainText("블로그 설정에서 종목을 넣어 보세요");
  const visitor = await browser.newPage();
  await visitor.goto(`/@${me}`);
  await expect(visitor.getByRole("heading", { name: "🔍 블로그 검색" })).toBeVisible();
  await expect(visitor.locator("[data-stock-widget]").getByRole("tablist", { name: "지수" })).toBeVisible();
  await expect(visitor.locator("[data-stock-widget] [data-stock]")).toHaveCount(0);
  await expect(visitor.locator("[data-stock-widget]")).not.toContainText("블로그 설정에서 종목을 넣어 보세요");
  // 검색은 회원만
  expect((await visitor.request.get("/api/stocks/search?q=삼성")).status()).toBe(401);

  await page.route("**/api/stocks/search?**", (route) => route.fulfill({ json: { items: [SAMSUNG, APPLE] } }));
  await page.goto("/settings/blog");
  const card = page.locator("#stocks");
  await card.getByLabel("종목 검색어").fill("삼성");
  await card.getByRole("button", { name: "종목 찾기" }).click();
  await card.locator('[data-stock-result="005930"]').getByRole("button", { name: "넣기" }).click();
  await expect(card.getByRole("status")).toHaveText("관심 종목에 넣었어요");
  await expect(card.locator('[data-my-stock="005930"]')).toBeVisible();
  await expect(card.locator('[data-stock-result="005930"]')).toContainText("넣음");
  await card.locator('[data-stock-result="AAPL.O"]').getByRole("button", { name: "넣기" }).click();
  await expect(card.locator('[data-my-stock="AAPL.O"]')).toBeVisible();
  await expect(card.getByText("넣은 종목 2/10")).toBeVisible();

  // 옆 칸: 넣은 순서, 스트림으로 새 시세 (오르면 ▲, 내리면 ▼)
  let calls = 0;
  const index = { code: "KOSPI", name: "코스피", price: 6078.84, change: 43.49, rate: 0.72, status: "OPEN", chart: [6035.35, 6050, 6070, 6060, 6078.84] };
  const quotes = [
    { ...SAMSUNG, price: 71000, change: 500, rate: 0.71, currency: "KRW", status: "OPEN" },
    { ...APPLE, price: 227.5, change: -1.25, rate: -0.55, currency: "USD", status: "OPEN" },
  ];
  await visitor.route("**/api/stocks/stream?**", (route) => {
    calls++;
    return route.fulfill({
      headers: { "content-type": "text/event-stream" },
      body: `retry: 60000\n\ndata: ${JSON.stringify({ quotes, index, at: new Date().toISOString() })}\n\n`,
    });
  });
  await visitor.goto(`/@${me}`);
  const widget = visitor.locator("[data-stock-widget]");
  await expect(widget.locator("[data-stock]")).toHaveCount(2);
  await expect(widget.locator("[data-stock]").first()).toContainText("삼성전자");
  await expect(widget.locator('[data-stock="005930"] [data-stock-price]')).toHaveText("71,000", { timeout: 10_000 });
  await expect(widget.locator('[data-stock="005930"] [data-stock-change]')).toHaveText("▲ 500 (+0.71%)");
  await expect(widget.locator('[data-stock="AAPL.O"] [data-stock-price]')).toHaveText("$227.50");
  await expect(widget.locator('[data-stock="AAPL.O"] [data-stock-change]')).toHaveText("▼ 1.25 (-0.55%)");
  expect(calls).toBeGreaterThanOrEqual(1);
  // 지수: 코스피 큰 숫자와 등락, 오늘 흐름 그래프
  await expect(widget.locator("[data-stock-index-price]")).toHaveText("6,078.84");
  await expect(widget.locator("div[data-stock-index]")).toContainText("▲43.49 +0.72%");
  await expect(widget.locator("[data-stock-index-chart]")).toBeVisible();
  // 코스닥 탭을 누르면 그 지수로 다시 연결한다
  await widget.getByRole("tab", { name: "코스닥" }).click();
  await expect.poll(() => calls).toBeGreaterThanOrEqual(2);
  // 방문자에게는 [종목 바꾸기]가 없다
  await expect(widget.getByRole("link", { name: /관심 종목 바꾸기/ })).toHaveCount(0);

  // 빼기
  await page.goto("/settings/blog");
  await card.locator('[data-my-stock="AAPL.O"]').getByRole("button", { name: "빼기" }).click();
  await expect(card.getByRole("status")).toHaveText("관심 종목에서 뺐어요");
  await expect(card.locator('[data-my-stock="AAPL.O"]')).toHaveCount(0);
  await expect(card.getByText("넣은 종목 1/10")).toBeVisible();
});

test("검색 결과가 아닌 값으로 조작한 종목은 넣을 수 없고, 이상한 블로그 주소로는 시세를 받지 않는다", async ({ page, browser }) => {
  await signUpOk(page);
  await page.route("**/api/stocks/search?**", (route) =>
    route.fulfill({ json: { items: [{ market: "KR", code: "<script>", name: "나쁜 값" }] } }),
  );
  await page.goto("/settings/blog");
  const card = page.locator("#stocks");
  await card.getByLabel("종목 검색어").fill("x");
  await card.getByRole("button", { name: "종목 찾기" }).click();
  await card.getByRole("button", { name: "넣기" }).click();
  await expect(card.getByRole("alert")).toHaveText("이 종목은 넣을 수 없어요. 검색 결과에서 골라 주세요.");
  await expect(card.getByText("넣은 종목 0/10")).toBeVisible();

  // 남의 블로그 주소로 시세를 물어도 그 블로그에 넣은 종목만 (없는 블로그는 빈 목록)
  const other = await browser.newPage();
  const res = await other.request.get("/api/stocks/quotes?blog=../../etc");
  expect(await res.json()).toMatchObject({ quotes: [] });
});

test("시세 연결 확인 주소는 입력 없이 정해 둔 종목만 묻는다", async ({ page }) => {
  const res = await page.request.get("/api/stocks/status");
  // 시험 환경에서는 네이버에 닿지 않을 수 있다 — 모양만 본다
  expect([200, 503]).toContain(res.status());
  const json = await res.json();
  expect(json.quotes.map((q: { code: string }) => q.code)).toEqual(["005930", "AAPL.O"]);
});
