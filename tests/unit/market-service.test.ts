import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveUpstream, UPSTREAMS } from "../../services/market/routes.mjs";
import { createMarketServer } from "../../services/market/server.mjs";

describe("시세·날씨 서비스 경로 풀이", () => {
  it("앞머리를 바깥 주소로 바꾸고 쿼리는 그대로 둔다", () => {
    expect(resolveUpstream("/naver/polling/api/realtime/domestic/stock/005930")).toMatchObject({
      url: "https://polling.finance.naver.com/api/realtime/domestic/stock/005930",
      ttl: 1_000,
    });
    expect(resolveUpstream("/open-meteo/api/v1/forecast?latitude=37.6&longitude=127")?.url).toBe(
      "https://api.open-meteo.com/v1/forecast?latitude=37.6&longitude=127",
    );
  });

  it("모르는 앞머리와 위로 올라가는 경로는 막는다", () => {
    expect(resolveUpstream("/evil/x")).toBeNull();
    expect(resolveUpstream("/naver/pollingx/a")).toBeNull();
    expect(resolveUpstream("/naver/polling/../../etc")).toBeNull();
    expect(resolveUpstream("/naver/polling//evil.com")).toBeNull();
    expect(resolveUpstream("naver/polling/a")).toBeNull();
  });

  it("앱의 바깥 API 기본 주소와 같은 곳을 가리킨다", () => {
    expect(Object.values(UPSTREAMS).map((u) => u.base)).toEqual(
      expect.arrayContaining([
        "https://polling.finance.naver.com",
        "https://api.stock.naver.com",
        "https://ac.stock.naver.com",
        "https://api.open-meteo.com",
        "https://air-quality-api.open-meteo.com",
      ]),
    );
  });
});

describe("시세·날씨 서비스 서버", () => {
  let upstream: Server;
  let market: Server;
  let calls = 0;
  let base = "";

  beforeAll(async () => {
    upstream = createServer((req, res) => {
      calls++;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ path: req.url }));
    });
    await new Promise<void>((r) => upstream.listen(0, "127.0.0.1", r));
    const up = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
    market = createMarketServer({ upstreams: { "/fake": { base: up, ttl: 60_000 } }, instance: "market-1" });
    await new Promise<void>((r) => market.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(market.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    upstream.close();
    market.close();
  });

  it("상태를 알려 준다", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.headers.get("x-served-by")).toBe("market-1");
    expect(await res.json()).toMatchObject({ status: "UP", service: "market" });
  });

  it("같은 요청은 기억해 두고 바깥에는 한 번만 묻는다", async () => {
    const a = await fetch(`${base}/fake/quote?code=1`).then((r) => r.json());
    const b = await fetch(`${base}/fake/quote?code=1`).then((r) => r.json());
    expect(a).toEqual({ path: "/quote?code=1" });
    expect(b).toEqual(a);
    expect(calls).toBe(1);
  });

  it("모르는 경로는 404, GET이 아니면 405", async () => {
    expect((await fetch(`${base}/nope`)).status).toBe(404);
    expect((await fetch(`${base}/fake/x`, { method: "POST" })).status).toBe(405);
  });
});
