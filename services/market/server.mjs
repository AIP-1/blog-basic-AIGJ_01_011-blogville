// 시세·날씨 서비스 (MSA 실습: 바깥 API를 부르는 일을 앱에서 떼어 낸 작은 서비스).
// 앱은 STOCK_*_BASE·WEATHER_BASE·AIR_BASE를 이 서비스 주소(http://market:8500/...)로 바꾸기만 하면 되고 코드는 그대로다.
// 같은 요청은 정해진 시간 동안 기억해 두어, 앱을 여러 벌 띄워도 바깥 API에는 한 번만 묻는다.
//
//   GET /health                       → {"status":"UP", ...}  (게이트웨이·docker healthcheck가 부름)
//   GET /naver/polling/...            → polling.finance.naver.com (1초 기억)
//   GET /naver/api/... /naver/ac/...  → api.stock.naver.com, ac.stock.naver.com (1분)
//   GET /open-meteo/api/... /air/...  → Open-Meteo 날씨·미세먼지 (30분)
//
// 외부 패키지 없이 Node만으로 돈다: node services/market/server.mjs
import { createServer } from "node:http";
import { hostname } from "node:os";
import { fileURLToPath } from "node:url";
import { resolveUpstream, UPSTREAMS } from "./routes.mjs";

const TIMEOUT_MS = 4_000;
const MAX_CACHE = 2_000;
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; Blogville market service)",
  Referer: "https://m.stock.naver.com/",
  Accept: "application/json",
};

/**
 * 시세·날씨 서비스 HTTP 서버를 만든다 (listen은 부르는 쪽이). 시험은 upstreams로 가짜 서버를 가리킨다.
 * @param {{ upstreams?: Record<string, {base: string, ttl: number}>, instance?: string }} [options]
 */
export function createMarketServer({ upstreams = UPSTREAMS, instance = process.env.HOSTNAME ?? hostname() } = {}) {
  /** url → { at, ttl, value: Promise<{status, body, type}> } */
  const cache = new Map();
  const stats = { requests: 0, upstream: 0, hits: 0, startedAt: new Date().toISOString() };

  function fetchUpstream(url) {
    stats.upstream++;
    return fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) })
      .then(async (res) => ({ status: res.status, type: res.headers.get("content-type") ?? "application/json", body: Buffer.from(await res.arrayBuffer()) }))
      .catch(() => ({ status: 502, type: "application/json", body: Buffer.from('{"error":"upstream"}') }));
  }

  function cached(url, ttl) {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < hit.ttl) {
      stats.hits++;
      return hit.value;
    }
    const entry = { at: Date.now(), ttl, value: fetchUpstream(url) };
    // 실패한 답은 오래 기억하지 않는다
    entry.value.then((r) => {
      if (r.status >= 400) entry.ttl = Math.min(ttl, 5_000);
    });
    cache.set(url, entry);
    if (cache.size > MAX_CACHE) for (const [k, v] of cache) if (Date.now() - v.at >= v.ttl) cache.delete(k);
    return entry.value;
  }

  // X-Served-By: 여러 벌 띄웠을 때 누가 답했는지
  function send(res, status, type, body) {
    res.writeHead(status, { "Content-Type": type, "X-Served-By": instance, "Cache-Control": "no-store" });
    res.end(body);
  }

  return createServer(async (req, res) => {
    stats.requests++;
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "application/json", '{"error":"GET only"}');
    if (req.url === "/health") {
      return send(res, 200, "application/json", JSON.stringify({ status: "UP", service: "market", instance, cached: cache.size, ...stats }));
    }
    const target = resolveUpstream(req.url ?? "", upstreams);
    if (!target) return send(res, 404, "application/json", '{"error":"unknown route"}');
    const r = await cached(target.url, target.ttl);
    send(res, r.status, r.type, r.body);
  });
}

// node server.mjs로 직접 띄웠을 때만 연다 (시험에서 import할 때는 열지 않음)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT ?? 8500);
  const server = createMarketServer();
  server.listen(port, () => console.log(`market service listening on :${port}`));
  for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => server.close(() => process.exit(0)));
}
