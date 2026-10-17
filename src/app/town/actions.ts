"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { blogs } from "@/db/schema";
import { checkComment } from "@/lib/comment-rules";
import { GUESTBOOK_ERRORS } from "@/lib/guestbook-rules";
import { NOTICE_SLUG, SLUG_RE } from "@/lib/names";
import { FAVORITE_MESSAGES } from "@/lib/social";
import { codePointLength } from "@/lib/text";
import { LOT_ERRORS } from "@/lib/town/lots";
import { TOWN_NOTE_MAX, TOWN_NOTE_TOO_LONG } from "@/lib/town/plaza";
import { checkBannedWords } from "@/server/banned-words";
import { requireMember } from "@/server/dal";
import { inviteNeighbor as inviteNeighborTx, setTownLot } from "@/server/follows";
import { createEntry } from "@/server/guestbook";

/**
 * ☰ 🏡 이웃 집 자리 (TOWN-18): 즐겨찾기 이웃(`followeeId`)을 `lot`번 자리로. 거절하면 문구를 돌려주고 저장하지 않는다.
 */
export async function chooseTownLot(formData: FormData): Promise<{ error: string | null }> {
  const member = await requireMember();
  const followeeId = formData.get("followeeId");
  const raw = formData.get("lot");
  if (typeof followeeId !== "string" || followeeId.length < 1 || followeeId.length > 64) return { error: LOT_ERRORS.notFavorite };
  const lot = typeof raw === "string" && /^\d{1,2}$/.test(raw) ? Number(raw) : null;
  const error = await setTownLot(member.userId, followeeId, lot);
  if (!error) revalidatePath("/", "layout");
  return { error };
}

type TownActionResult = { ok: true } | { error: string };

/**
 * 이사 올 이웃 모시기 (plaza-upgrade-2, B1): 빈 집터의 추천 이웃 `slug`을 이웃 추가·⭐ 즐겨찾기하고 `lot`번 자리에 둔다.
 * 거절(공지 블로그·10명·자리 번호·이미 산 자리)은 문구로. 새 보상 없음. 광장만 다시 그린다(시작 자리 열쇠가 같아 서 있던 자리는 그대로).
 */
export async function inviteNeighbor(slug: string, lot: number): Promise<TownActionResult> {
  const member = await requireMember();
  if (typeof slug !== "string" || !SLUG_RE.test(slug)) return { error: FAVORITE_MESSAGES.notFound };
  const error = await inviteNeighborTx(member.userId, slug, lot);
  if (error) return { error };
  revalidatePath("/town");
  return { ok: true };
}

/**
 * 마을 우체통 쪽지 (plaza-upgrade-2, B3): `slug` 블로그의 방명록에 글을 남긴다(`createEntry`: 주인 알림·시간당 상한 그대로).
 * 내용 규칙은 방명록과 같고(금칙어 포함) 쪽지는 200자까지. 공지 블로그와 내 블로그에는 남기지 않는다.
 * 마을을 다시 그리지 않게 다시 읽기(revalidate) 없이 결과만 돌려준다.
 */
export async function leaveTownNote(slug: string, content: string, isSecret: boolean): Promise<TownActionResult> {
  const member = await requireMember();
  if (typeof slug !== "string" || !SLUG_RE.test(slug) || slug === NOTICE_SLUG) return { error: GUESTBOOK_ERRORS.blogNotFound };
  const checked = checkComment(typeof content === "string" ? content : "");
  if (!checked.ok) return { error: checked.error };
  if (codePointLength(checked.content) > TOWN_NOTE_MAX) return { error: TOWN_NOTE_TOO_LONG };
  const banned = await checkBannedWords(checked.content);
  if (banned) return { error: banned };
  const [blog] = await db.select({ id: blogs.id, ownerId: blogs.ownerId }).from(blogs).where(eq(blogs.slug, slug));
  if (!blog || blog.ownerId === member.userId) return { error: GUESTBOOK_ERRORS.blogNotFound };
  const result = await createEntry(member.userId, blog.id, checked.content, isSecret === true);
  return result.ok ? { ok: true } : { error: result.error };
}
