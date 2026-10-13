import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { bannedWordError } from "@/lib/admin-rules";

// 금지어 (ADM-05, specs/058-admin-tools). 글·댓글·방명록·문의를 저장할 때마다 읽으므로 잠깐(30초) 기억해 둔다.
// 관리자가 바꾸면 이 서버의 기억은 바로 지운다 (clearBannedWordsCache). 서버가 여러 대면 다른 서버는 30초 안에 따라온다.

export const BANNED_KEY = "banned_words";
const TTL_MS = 30_000;

/** 금지어 목록 (DB에서 바로). site_settings의 값은 한 줄에 하나 */
export async function readBannedWords(): Promise<string[]> {
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, BANNED_KEY));
  return row ? row.value.split("\n").filter(Boolean) : [];
}

// 개발 서버가 모듈을 다시 불러와도 같은 기억을 쓴다
const store = globalThis as unknown as { bannedWordsCache?: { words: string[]; at: number } };

export async function getBannedWords(): Promise<string[]> {
  const hit = store.bannedWordsCache;
  if (hit && Date.now() - hit.at < TTL_MS) return hit.words;
  const words = await readBannedWords();
  store.bannedWordsCache = { words, at: Date.now() };
  return words;
}

export function clearBannedWordsCache() {
  store.bannedWordsCache = undefined;
}

/** 여러 칸 중 하나라도 금지어가 있으면 `사용할 수 없는 말이 들어 있어요: {단어}`, 없으면 null. 관리자도 같다 */
export async function checkBannedWords(...texts: string[]): Promise<string | null> {
  return bannedWordError(await getBannedWords(), ...texts);
}
