// 🍽 맛집의 ⭐ 가고 싶은 곳과 [후기 쓰기] 미리 채우기. 화면·서버가 같이 쓰는 순수 함수만 둔다.
import type { FoodPlace } from "./food";
import { parseTags } from "./post-rules";

export const PLACE_NAME_MAX = 100;
export const PLACE_ID_MAX = 200;
const TEXT_MAX = 300;
const URL_MAX = 1000;

/** /write?place_name=…의 식당 정보 (reviewWriteHref가 만든다) */
export type PlacePrefill = { name: string; category: string; address: string; url: string };

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const v = value.trim().replace(/\s+/g, " ");
  return v.length > max ? "" : v;
}

/** http(s) 주소만. 아니면 빈 문자열 */
export function safeHttpUrl(value: unknown): string {
  const v = text(value, URL_MAX);
  if (!v) return "";
  try {
    const url = new URL(v);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

/** 주소창 값 → 식당 정보. 이름이 없거나 너무 길면 null (미리 채우지 않음) */
export function parsePlacePrefill(params: Record<string, string | string[] | undefined>): PlacePrefill | null {
  const one = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const name = text(one("place_name"), PLACE_NAME_MAX);
  if (!name) return null;
  return {
    name,
    category: text(one("place_category"), TEXT_MAX),
    address: text(one("place_address"), TEXT_MAX),
    url: safeHttpUrl(one("place_url")),
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 본문 맨 앞에 넣는 식당 카드 (인용 상자). 글 본문 정화가 허용하는 태그만 쓴다 */
export function placeCardHtml(p: PlacePrefill): string {
  const head = `<strong>🍽 ${escapeHtml(p.name)}</strong>${p.category ? ` · ${escapeHtml(p.category)}` : ""}`;
  const lines = [`<p>${head}</p>`];
  if (p.address) lines.push(`<p>📍 ${escapeHtml(p.address)}</p>`);
  if (p.url) lines.push(`<p><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer nofollow">🗺 지도에서 보기</a></p>`);
  return `<blockquote>${lines.join("")}</blockquote><p></p>`;
}

/** 태그 칸에 "맛집, <식당 이름>"을 더한다 (이미 있으면 그대로, 규칙에 안 맞는 태그는 parseTags가 버림) */
export function withPlaceTags(existing: string, name: string): string {
  return parseTags([existing, "맛집", name].filter(Boolean).join(",")).join(", ");
}

/** 화면에서 넘어온 식당 → 저장할 값. 모양이 틀리면 null */
export function normalizePlace(input: unknown): FoodPlace | null {
  if (typeof input !== "object" || input === null) return null;
  const o = input as Record<string, unknown>;
  const id = text(o.id, PLACE_ID_MAX);
  const name = text(o.name, PLACE_NAME_MAX);
  if (!id || !name) return null;
  const coord = (v: unknown, limit: number) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= limit ? v : null);
  return {
    id,
    name,
    category: text(o.category, TEXT_MAX),
    address: text(o.address, TEXT_MAX),
    phone: text(o.phone, 40),
    mapUrl: safeHttpUrl(o.mapUrl),
    lat: coord(o.lat, 90),
    lng: coord(o.lng, 180),
    distance: null,
  };
}
