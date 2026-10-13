import "server-only";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { attachments, profiles, users } from "@/db/schema";
import { BLOG_ERRORS } from "@/lib/blog-rules";
import { isUniqueViolation, lockName } from "./names";

/** 닉네임 바꾸기 (BLOG-03). 다른 회원의 아이디(대소문자 무시)·닉네임(글자 그대로)과 겹칠 수 없다. */
export async function updateNickname(userId: string, rawNickname: string): Promise<string | null> {
  const nickname = rawNickname.trim();
  try {
    return await db.transaction(async (tx) => {
      await lockName(tx, nickname);
      const [user] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(sql`lower(${users.username})`, nickname.toLowerCase()), ne(users.id, userId)))
        .limit(1);
      const [other] = await tx
        .select({ id: profiles.userId })
        .from(profiles)
        .where(and(eq(profiles.nickname, nickname), ne(profiles.userId, userId)))
        .limit(1);
      if (user || other) return BLOG_ERRORS.nicknameTaken;
      await tx.update(profiles).set({ nickname }).where(eq(profiles.userId, userId));
      return null;
    });
  } catch (e) {
    if (isUniqueViolation(e)) return BLOG_ERRORS.nicknameTaken;
    throw e;
  }
}

export const PHOTO_ERRORS = {
  invalid: "이 사진은 프로필 사진으로 쓸 수 없어요. 다시 올려 주세요.",
  saved: "프로필 사진을 바꿨어요",
  removed: "프로필 사진을 지웠어요",
} as const;

/** 프로필 사진 (BLOG-03): 주소에 쓸 첨부 키, 없으면 null */
export async function getProfilePhotoKey(userId: string): Promise<string | null> {
  const [row] = await db.select({ key: profiles.photoKey }).from(profiles).where(eq(profiles.userId, userId));
  return row?.key ?? null;
}

/**
 * 프로필 사진 바꾸기 (BLOG-03): 내가 방금(1시간 안) 올렸고 어느 글에도 붙지 않은 사진 첨부만 받는다.
 * 잠금 순서는 프로필 → 첨부다(글 저장 `savePost`·지우기와 같은 순서, 교착 방지). 프로필을 먼저 잠가 같은 사진이 그 사이 글에 붙지 않게 하고,
 * 막 올린 것만 받아 정리 작업(하루 지난 것만 지움)과 겹치지 않는다. 전 사진은 떨어진 첨부가 되어 하루 뒤 정리 작업이 지운다.
 */
export async function setProfilePhoto(userId: string, key: string): Promise<string | null> {
  return db.transaction(async (tx) => {
    const [old] = await tx.select({ key: profiles.photoKey }).from(profiles).where(eq(profiles.userId, userId)).for("update");
    if (!old) return PHOTO_ERRORS.invalid;
    if (old.key === key) return null;
    const [photo] = await tx
      .select({ key: attachments.key })
      .from(attachments)
      .where(
        and(
          eq(attachments.key, key),
          eq(attachments.userId, userId),
          eq(attachments.kind, "image"),
          isNull(attachments.postId),
          sql`${attachments.createdAt} > now() - interval '1 hour'`,
        ),
      )
      .for("update");
    if (!photo) return PHOTO_ERRORS.invalid;
    await tx.update(profiles).set({ photoKey: key }).where(eq(profiles.userId, userId));
    if (old.key) await tx.update(attachments).set({ detachedAt: sql`now()` }).where(eq(attachments.key, old.key));
    return null;
  });
}

/** 프로필 사진 지우기: 비우고, 그 첨부는 하루 뒤 정리 작업이 지운다 */
export async function removeProfilePhoto(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [old] = await tx.select({ key: profiles.photoKey }).from(profiles).where(eq(profiles.userId, userId)).for("update");
    if (!old?.key) return;
    await tx.update(profiles).set({ photoKey: null }).where(eq(profiles.userId, userId));
    await tx.update(attachments).set({ detachedAt: sql`now()` }).where(eq(attachments.key, old.key));
  });
}
