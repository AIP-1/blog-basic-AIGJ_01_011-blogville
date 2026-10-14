import "server-only";
import path from "node:path";
import { ocrSaysSponsored } from "@/lib/food-sponsor";

// 🍽 협찬 배너 그림 읽기: 글에 협찬 문구가 없을 때 글 앞뒤 그림 몇 장의 글자를 읽어 "협찬을 포함합니다" 같은 배너를 찾는다.
// 화면을 기다리게 하지 않으려고 뒤에서 하나씩 읽고, 결과는 글 주소로 하루 동안 기억한다.
// 화면은 /api/food/sponsor로 다 읽은 글을 물어 카드에 💰 협찬을 이어 붙인다.
// 글자 인식은 tesseract.js(한국어 데이터는 @tesseract.js-data/kor, 이미지 안에 함께 들어 있어 밖에서 받지 않는다).

export type OcrState = "pending" | "sponsored" | "none";

const TTL_MS = 24 * 3_600_000;
const IMAGE_TIMEOUT_MS = 5_000;
const IMAGE_MAX_BYTES = 1_500_000;
const QUEUE_MAX = 300;
const IDLE_MS = 5 * 60_000;

// 화면(서버 컴포넌트)과 /api/food/sponsor는 따로 묶여 모듈이 둘로 나뉠 수 있어 결과는 globalThis에 함께 둔다
type Store = { results: Map<string, { at: number; state: OcrState }>; queue: { url: string; images: string[] }[]; running: boolean };
const store: Store = ((globalThis as { __foodOcr?: Store }).__foodOcr ??= { results: new Map(), queue: [], running: false });
const { results, queue } = store;

type Worker = { recognize(img: Buffer): Promise<{ data: { text: string } }>; terminate(): Promise<unknown> };
let worker: Promise<Worker> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

export function ocrEnabled(): boolean {
  return process.env.FOOD_OCR !== "off";
}

function getWorker(): Promise<Worker> {
  if (!worker) {
    worker = (async () => {
      const { createWorker } = await import("tesseract.js");
      const langPath = path.join(process.cwd(), "node_modules/@tesseract.js-data/kor/4.0.0");
      return (await createWorker("kor", 1, { langPath, gzip: true, cacheMethod: "none" })) as unknown as Worker;
    })();
    worker.catch(() => {
      worker = null;
    });
  }
  return worker;
}

/** 한동안 쓰지 않으면 글자 인식기를 내려 메모리를 돌려준다 */
function scheduleIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const w = worker;
    worker = null;
    w?.then((x) => x.terminate()).catch(() => {});
  }, IDLE_MS);
  idleTimer.unref?.();
}

async function fetchImage(url: string): Promise<Buffer | null> {
  // 시험은 FOOD_IMAGE_BASE로 가짜 서버를 가리킨다
  const target = process.env.FOOD_IMAGE_BASE ? `${process.env.FOOD_IMAGE_BASE}/image?u=${encodeURIComponent(url)}` : url;
  const res = await fetch(target, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; BlogvilleBot/1.0)", Referer: "https://m.blog.naver.com/" },
    signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
  const buf = await res.arrayBuffer();
  return buf.byteLength > IMAGE_MAX_BYTES ? null : Buffer.from(buf);
}

async function readOne(job: { url: string; images: string[] }): Promise<OcrState> {
  const w = await getWorker();
  for (const img of job.images) {
    const buf = await fetchImage(img).catch(() => null);
    if (!buf) continue;
    const text = await w
      .recognize(buf)
      .then((r) => r.data.text)
      .catch(() => "");
    if (ocrSaysSponsored(text)) return "sponsored";
  }
  return "none";
}

async function drain() {
  if (store.running) return;
  store.running = true;
  try {
    while (queue.length) {
      const job = queue.shift()!;
      const state = await readOne(job).catch(() => "none" as const);
      results.set(job.url, { at: Date.now(), state });
    }
  } finally {
    store.running = false;
    scheduleIdle();
  }
}

/** 이 글의 그림 읽기를 뒤에 줄 세운다 (이미 읽었거나 줄에 있으면 그대로) */
export function queueSponsorOcr(url: string, images: string[]): void {
  if (!ocrEnabled() || images.length === 0) return;
  const hit = results.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return;
  if (queue.length >= QUEUE_MAX) return;
  results.set(url, { at: Date.now(), state: "pending" });
  queue.push({ url, images });
  if (results.size > 5_000) for (const [k, v] of results) if (Date.now() - v.at >= TTL_MS) results.delete(k);
  void drain();
}

/** 그림 읽기 결과 (모르면 null) */
export function sponsorOcrState(url: string): OcrState | null {
  const hit = results.get(url);
  if (!hit) return null;
  if (hit.state !== "pending" && Date.now() - hit.at >= TTL_MS) return null;
  return hit.state;
}
