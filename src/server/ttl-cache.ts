import "server-only";

// 여러 사람이 같은 값을 보는 무거운 집계(인기 글 순위, 인기 태그 등)를 잠깐 기억한다.
// 서버 한 대(블루-그린 중 켜진 쪽)의 메모리라 다시 켜지면 비고, 같은 때 들어온 요청은 한 번만 센다.
// 개발 서버와 화면 시험(e2e, 운영 빌드에 SHARED_CACHE=off)은 방금 쓴 글이 바로 보여야 해서 끈다.

type Entry = { at: number; value: Promise<unknown> };
const store: Map<string, Entry> = ((globalThis as { __bvTtlCache?: Map<string, Entry> }).__bvTtlCache ??= new Map());

const MAX_KEYS = 500;

export function cacheEnabled(): boolean {
  return process.env.NODE_ENV === "production" && process.env.SHARED_CACHE !== "off";
}

/** key로 ttlMs 동안 load 결과를 나눠 쓴다. 실패한 결과는 기억하지 않는다 */
export function cached<T>(key: string, ttlMs: number, load: () => PromiseLike<T>, now = Date.now()): Promise<T> {
  if (!cacheEnabled()) return Promise.resolve().then(load);
  const hit = store.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value as Promise<T>;
  // 드리즐 질의는 await할 때마다 다시 실행되므로 진짜 Promise로 한 번만 돌린다
  const value = Promise.resolve().then(load);
  store.delete(key);
  store.set(key, { at: now, value });
  value.catch(() => {
    if (store.get(key)?.value === value) store.delete(key);
  });
  if (store.size > MAX_KEYS) {
    // 가장 오래 넣은 것부터 지운다 (Map은 넣은 순서)
    for (const k of store.keys()) {
      store.delete(k);
      if (store.size <= MAX_KEYS) break;
    }
  }
  return value;
}

/** 시험용: 기억한 값을 모두 지운다 */
export function clearCached() {
  store.clear();
}
