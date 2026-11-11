import "server-only";
import { parseYahooTick, yahooTicker, type YahooTick } from "@/lib/stocks";

// 📈 미국 주식 데이마켓 실시간 가격: 야후 파이낸스가 화면에 쓰는 실시간 스트림(웹소켓)을 서버가 하나만 열어 둔다.
// 체결이 날 때마다(보통 1초 안팎) 가격이 들어오고, 위젯은 받아 둔 마지막 값을 바로 쓴다 (기다림 없음).
// 화면에서 그 종목을 5분 넘게 찾지 않으면 구독을 풀고, 아무 종목도 없으면 연결을 닫는다.
// 시험은 YAHOO_STREAM_URL로 가짜 서버를 가리킨다.
const URL_ = () => process.env.YAHOO_STREAM_URL ?? "wss://streamer.finance.yahoo.com/?version=2";
const IDLE_MS = 5 * 60_000;
// 데이마켓 가격으로 쓸 수 있는 가장 오래된 체결 (거래가 뜸한 종목도 12시간 안 체결이면 이번 데이마켓 것)
const MAX_AGE_MS = 12 * 3_600_000;

type State = {
  socket: WebSocket | null;
  latest: Map<string, YahooTick & { at: number }>;
  wanted: Map<string, number>;
  waiters: Map<string, (() => void)[]>;
  waited: Set<string>;
  retryMs: number;
  timer: ReturnType<typeof setInterval> | null;
  // 운영 점검용 (/api/stocks/status)
  lastMessageAt?: number;
  lastError?: string;
  opens?: number;
};

// 개발 서버가 다시 읽어도 연결이 하나만 남게 globalThis에 둔다
const g = globalThis as unknown as { __bvYahooStream?: State };
const state: State = (g.__bvYahooStream ??= { socket: null, latest: new Map(), wanted: new Map(), waiters: new Map(), waited: new Set(), retryMs: 2_000, timer: null });

function send(msg: object) {
  if (state.socket?.readyState === WebSocket.OPEN) state.socket.send(JSON.stringify(msg));
}

function connect() {
  if (state.socket || state.wanted.size === 0) return;
  let ws: WebSocket;
  try {
    ws = new WebSocket(URL_());
  } catch {
    return;
  }
  state.socket = ws;
  ws.onopen = () => {
    state.retryMs = 2_000;
    state.opens = (state.opens ?? 0) + 1;
    send({ subscribe: [...state.wanted.keys()] });
  };
  ws.onmessage = (e) => {
    if (typeof e.data !== "string") return;
    let message: unknown;
    try {
      message = (JSON.parse(e.data) as { message?: unknown }).message;
    } catch {
      return;
    }
    const tick = typeof message === "string" ? parseYahooTick(message) : null;
    if (!tick) return;
    state.lastMessageAt = Date.now();
    state.latest.set(tick.id, { ...tick, at: Date.now() });
    for (const done of state.waiters.get(tick.id) ?? []) done();
    state.waiters.delete(tick.id);
  };
  ws.onclose = (e) => {
    if (e.code !== 1000) state.lastError = `${new Date().toISOString()} 닫힘 ${e.code} ${e.reason}`.trim();
    if (state.socket === ws) state.socket = null;
    // 아직 찾는 종목이 있으면 조금 기다렸다 다시 연결 (2초부터 1분까지 늘려 가며)
    if (state.wanted.size > 0) {
      setTimeout(connect, state.retryMs).unref?.();
      state.retryMs = Math.min(state.retryMs * 2, 60_000);
    }
  };
  ws.onerror = (e) => {
    state.lastError = `${new Date().toISOString()} ${(e as ErrorEvent).message || "연결 오류"}`;
    try {
      ws.close();
    } catch {}
  };
  if (!state.timer) {
    state.timer = setInterval(() => {
      const now = Date.now();
      const drop = [...state.wanted].filter(([, at]) => now - at > IDLE_MS).map(([t]) => t);
      if (drop.length) {
        drop.forEach((t) => {
          state.wanted.delete(t);
          state.waited.delete(t);
        });
        send({ unsubscribe: drop });
      }
      if (state.wanted.size === 0) {
        state.socket?.close();
        state.socket = null;
        if (state.timer) clearInterval(state.timer);
        state.timer = null;
      }
    }, 60_000);
    state.timer.unref?.();
  }
}

/** 이 종목들을 실시간으로 받게 한다 (처음 찾는 종목은 구독을 더한다) */
function want(tickers: string[]) {
  const fresh = tickers.filter((t) => !state.wanted.has(t));
  for (const t of tickers) state.wanted.set(t, Date.now());
  if (!state.socket) connect();
  else if (fresh.length) send({ subscribe: fresh });
}

/**
 * 미국 종목(네이버 로이터 코드)의 데이마켓 실시간 가격 (정규장 종가 대비 등락).
 * 아직 받은 값이 없으면 첫 체결을 waitMs까지만 기다리고, 그래도 없으면 null (다른 곳으로 넘어간다)
 */
export async function getStreamOvernight(code: string, waitMs = 1_500): Promise<{ price: number; change: number | null; rate: number | null } | null> {
  const ticker = yahooTicker(code);
  if (!ticker) return null;
  want([ticker]);
  const fresh = () => {
    const t = state.latest.get(ticker);
    // 4 = 데이마켓(overnight) 체결. 어제 애프터 체결이 남아 있으면 쓰지 않는다
    return t && (t.marketHours === 4 || t.marketHours === null) && Date.now() - t.time < MAX_AGE_MS ? t : null;
  };
  // 첫 체결은 한 번만 기다린다 (거래가 뜸한 종목 때문에 매번 기다리지 않게)
  if (!fresh() && waitMs > 0 && !state.waited.has(ticker)) {
    state.waited.add(ticker);
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, waitMs);
      const list = state.waiters.get(ticker) ?? [];
      list.push(() => {
        clearTimeout(timer);
        resolve();
      });
      state.waiters.set(ticker, list);
    });
  }
  const t = fresh();
  return t ? { price: t.price, change: t.change, rate: t.changePercent } : null;
}

/** 운영 점검용: 스트림 연결 상태 */
export function yahooStreamStatus() {
  return {
    state: state.socket ? ["연결 중", "열림", "닫는 중", "닫힘"][state.socket.readyState] : "없음",
    opens: state.opens ?? 0,
    wanted: [...state.wanted.keys()],
    lastMessageAt: state.lastMessageAt ? new Date(state.lastMessageAt).toISOString() : null,
    lastError: state.lastError ?? null,
    latest: [...state.latest.values()].map((t) => ({ id: t.id, price: t.price, marketHours: t.marketHours, at: new Date(t.at).toISOString() })),
  };
}
