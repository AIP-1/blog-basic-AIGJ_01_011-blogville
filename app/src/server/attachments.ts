import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNull, notInArray, or, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { attachments, blogs, posts, profiles, type Attachment } from "@/db/schema";
import { pasteAction, type AttachmentKind, type PasteAction } from "@/lib/attachments";
import { copyFile, deleteFile, listFiles, saveFile } from "./storage";

/** 지금 누군가의 프로필 사진인 첨부 (BLOG-04): 글에 붙이지 않고, 누구나 보며, 정리하지 않는다 */
const isProfilePhotoSql = sql<boolean>`exists (select 1 from ${profiles} where ${profiles.photoKey} = ${attachments.key})`;

/** 올린 파일을 저장하고 붙지 않은 첨부 행을 만든다 (POST-07 흐름 3) */
export async function createAttachment(
  userId: string,
  file: { kind: AttachmentKind; name: string; mime: string; data: Uint8Array },
): Promise<Attachment> {
  const key = randomBytes(16).toString("hex");
  await saveFile(key, file.data);
  try {
    const [row] = await db
      .insert(attachments)
      .values({ key, userId, kind: file.kind, name: file.name, mime: file.mime, size: file.data.byteLength })
      .returning();
    return row;
  } catch (e) {
    await deleteFile(key);
    throw e;
  }
}

/**
 * 붙여 넣은 키마다 할 일 (POST-07 흐름 7). 이름은 내 첨부만 알려 준다 (실패 문구용).
 */
export async function classifyPasted(userId: string, keys: string[], editingPostId: number | null) {
  const rows = keys.length
    ? await db
        .select({ key: attachments.key, uploaderId: attachments.userId, postId: attachments.postId, name: attachments.name, isProfilePhoto: isProfilePhotoSql })
        .from(attachments)
        .where(inArray(attachments.key, keys))
    : [];
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return keys.map((key) => {
    const row = byKey.get(key);
    const action: PasteAction = pasteAction(row, userId, editingPostId);
    return { key, action, name: action === "drop" ? "" : row!.name };
  });
}

/**
 * 내 다른 글에 붙은 첨부를 새 키로 복사해 붙지 않은 첨부로 만든다 (원래 첨부는 그대로).
 * 서버에서 다시 판정해 keep이면 같은 키, drop이면 null.
 */
export async function reuploadAttachment(userId: string, key: string, editingPostId: number | null): Promise<string | null> {
  const [found] = await db.select({ row: attachments, isProfilePhoto: isProfilePhotoSql }).from(attachments).where(eq(attachments.key, key)).limit(1);
  const row = found?.row;
  const action = pasteAction(row && { uploaderId: row.userId, postId: row.postId, isProfilePhoto: found.isProfilePhoto }, userId, editingPostId);
  if (action !== "reupload") return action === "keep" ? key : null;
  const newKey = randomBytes(16).toString("hex");
  await copyFile(key, newKey);
  try {
    await db.insert(attachments).values({ key: newKey, userId, kind: row.kind, name: row.name, mime: row.mime, size: row.size });
  } catch (e) {
    await deleteFile(newKey);
    throw e;
  }
  return newKey;
}

/** 보기용: 첨부와 붙은 글의 공개 설정·블로그 주인, 프로필 사진인지 */
export async function findReadableAttachment(key: string) {
  const [row] = await db
    .select({
      key: attachments.key,
      kind: attachments.kind,
      name: attachments.name,
      mime: attachments.mime,
      uploaderId: attachments.userId,
      postId: attachments.postId,
      postIsPublic: posts.isPublic,
      blogOwnerId: blogs.ownerId,
      isProfilePhoto: isProfilePhotoSql,
    })
    .from(attachments)
    .leftJoin(posts, eq(posts.id, attachments.postId))
    .leftJoin(blogs, eq(blogs.id, posts.blogId))
    .where(eq(attachments.key, key))
    .limit(1);
  return row ?? null;
}

export type LinkableAttachment = Pick<Attachment, "key" | "kind" | "name" | "size">;

/**
 * 본문의 키 중 이 글에 붙일 수 있는 첨부를 잠그고 돌려준다 (FR-005).
 * ① 행 있음 ② 내가 올림 ③ 붙지 않았거나 이 글 것 (새 글이면 붙지 않은 것만) ④ 프로필 사진이 아님.
 * 키 순서로 잠가 두 저장이 서로 기다리다 막히지 않게 한다.
 */
export async function lockLinkable(tx: Tx, userId: string, postId: number | null, keys: string[]) {
  if (keys.length === 0) return new Map<string, LinkableAttachment>();
  const rows = await tx
    .select({ key: attachments.key, kind: attachments.kind, name: attachments.name, size: attachments.size })
    .from(attachments)
    .where(
      and(
        inArray(attachments.key, keys),
        eq(attachments.userId, userId),
        postId === null ? isNull(attachments.postId) : or(isNull(attachments.postId), eq(attachments.postId, postId)),
        sql`not ${isProfilePhotoSql}`,
      ),
    )
    .orderBy(attachments.key)
    .for("update");
  return new Map(rows.map((r) => [r.key, r]));
}

/** 남은 키는 이 글에 붙이고, 이 글에 붙어 있다 빠진 첨부는 떨어뜨린다 */
export async function syncPostAttachments(tx: Tx, postId: number, keys: string[]) {
  await tx
    .update(attachments)
    .set({ postId: null })
    .where(and(eq(attachments.postId, postId), keys.length ? notInArray(attachments.key, keys) : undefined));
  if (keys.length) {
    await tx
      .update(attachments)
      .set({ postId })
      // 그 사이 프로필 사진이 된 첨부는 붙이지 않는다
      .where(and(inArray(attachments.key, keys), or(isNull(attachments.postId), eq(attachments.postId, postId)), sql`not ${isProfilePhotoSql}`));
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * 정리 작업 (FR-009): ① 붙지 않은 지(한 번도 안 붙었으면 올린 지) 하루 지난 첨부(프로필 사진 빼고)의 행과 파일
 * ② 행이 없는 저장소 파일 중 1시간 지난 것. 저장 중이라 잠긴 행은 건너뛴다.
 */
export async function cleanupAttachments({ dryRun = false, now = new Date() } = {}) {
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const stale = sql`${attachments.postId} is null and coalesce(${attachments.detachedAt}, ${attachments.createdAt}) < ${dayAgo.toISOString()}::timestamptz and not ${isProfilePhotoSql}`;

  let removed: string[];
  if (dryRun) {
    removed = (await db.select({ key: attachments.key }).from(attachments).where(stale)).map((r) => r.key);
  } else {
    removed = await db.transaction(async (tx) => {
      const rows = await tx.select({ key: attachments.key }).from(attachments).where(stale).for("update", { skipLocked: true });
      const keys = rows.map((r) => r.key);
      if (keys.length) await tx.delete(attachments).where(inArray(attachments.key, keys));
      return keys;
    });
    for (const key of removed) await deleteFile(key);
  }

  const hourAgo = new Date(now.getTime() - HOUR_MS);
  const old = (await listFiles()).filter((f) => f.modifiedAt < hourAgo).map((f) => f.key);
  const known = new Set<string>();
  for (let i = 0; i < old.length; i += 1000) {
    const chunk = old.slice(i, i + 1000);
    const rows = await db.select({ key: attachments.key }).from(attachments).where(inArray(attachments.key, chunk));
    rows.forEach((r) => known.add(r.key));
  }
  const orphans = old.filter((k) => !known.has(k) && !removed.includes(k));
  if (!dryRun) for (const key of orphans) await deleteFile(key);

  return { attachments: removed.length, orphans: orphans.length };
}
