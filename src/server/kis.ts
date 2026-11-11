import "server-only";
import { kisDaySymbol, parseKisPrice } from "@/lib/stocks";

// 📈 미국 주식 데이마켓(주간거래) 시세: 한국투자증권 KIS Open API. 네이버 증권이 이 시간 가격을 주지 않아서 쓴다.
// 열쇠(KIS_APP_KEY·KIS_APP_SECRET)가 있을 때만 켜지고, 시세 조회만 한다 (주문·계좌 조회는 하지 않는다).
// 시험은 KIS_API_BASE로 가짜 서버를 가리킨다.
const BASE = () => process.env.KIS_API_BASE ?? "https://openapi.koreainvestment.com:9443";
const TIMEOUT_MS = 3_000;
// 같은 종목은 2초 동안 같은 값을 함께 쓴다 (실시간 스트림이 1.5초마다 물어도 KIS에는 2초에 한 번)
const PRICE_TTL_MS = 2_000;
// 접근 토큰은 하루 동안 쓴다. 발급은 1분에 한 번만 되므로 실패하면 1분 넘게 기다렸다 다시 받는다
const TOKEN_RETRY_MS = 65_000;

export function kisEnabled(): boolean {
  return !!(process.env.KIS_APP_KEY && process.env.KIS_APP_SECRET);
}

let token: { value: string; expiresAt: number } | null = null;
let tokenPending: Promise<string | null> | null = null;
let tokenFailedAt = 0;

async function accessToken(): Promise<string | null> {
  if (token && Date.now() < token.expiresAt - 10 * 60_000) return token.value;
  if (tokenPending) return tokenPending;
  if (Date.now() - tokenFailedAt < TOKEN_RETRY_MS) return null;
  tokenPending = (async () => {
    try {
      const res = await fetch(`${BASE()}/oauth2/tokenP`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grant_type: "client_credentials", appkey: process.env.KIS_APP_KEY, appsecret: process.env.KIS_APP_SECRET }),
        signal: AbortSignal.timeout(TIMEOUT_MS * 2),
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as { access_token?: unknown; expires_in?: unknown } | null;
      if (!res.ok || typeof json?.access_token !== "string") throw new Error(`kis token ${res.status}`);
      const ttl = typeof json.expires_in === "number" ? json.expires_in * 1000 : 23 * 3_600_000;
      token = { value: json.access_token, expiresAt: Date.now() + ttl };
      return token.value;
    } catch (e) {
      console.warn("[kis] 토큰을 받지 못함", e instanceof Error ? e.message : e);
      tokenFailedAt = Date.now();
      return null;
    } finally {
      tokenPending = null;
    }
  })();
  return tokenPending;
}

type DayPrice = { price: number; change: number | null; rate: number | null };
const priceCache = new Map<string, { at: number; value: Promise<DayPrice | null> }>();

/** 미국 종목(네이버 로이터 코드)의 데이마켓 가격. 열쇠가 없거나 못 받으면 null */
export function getDayPrice(code: string): Promise<DayPrice | null> {
  const sym = kisDaySymbol(code);
  if (!kisEnabled() || !sym) return Promise.resolve(null);
  const key = `${sym.excd}:${sym.symb}`;
  const hit = priceCache.get(key);
  if (hit && Date.now() - hit.at < PRICE_TTL_MS) return hit.value;
  const value = (async () => {
    const auth = await accessToken();
    if (!auth) return null;
    const q = new URLSearchParams({ AUTH: "", EXCD: sym.excd, SYMB: sym.symb });
    const res = await fetch(`${BASE()}/uapi/overseas-price/v1/quotations/price?${q}`, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        authorization: `Bearer ${auth}`,
        appkey: process.env.KIS_APP_KEY!,
        appsecret: process.env.KIS_APP_SECRET!,
        tr_id: "HHDFS00000300",
        custtype: "P",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) token = null;
    return res.ok ? parseKisPrice(await res.json()) : null;
  })().catch(() => null);
  priceCache.set(key, { at: Date.now(), value });
  if (priceCache.size > 1_000) for (const [k, v] of priceCache) if (Date.now() - v.at >= PRICE_TTL_MS) priceCache.delete(k);
  return value;
}
