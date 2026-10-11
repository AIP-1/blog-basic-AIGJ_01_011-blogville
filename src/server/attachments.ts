import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNull, notInArray, or, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { attachments, blogs, posts, type Attachment } from "@/db/schema";
import type { AttachmentKind } from "@/lib/attachments";
import { deleteFile, listFiles, saveFile } from "./storage";

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

/** 보기용: 첨부와 붙은 글의 공개 설정·블로그 주인 */
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
 * ① 행 있음 ② 내가 올림 ③ 붙지 않았거나 이 글 것 (새 글이면 붙지 않은 것만).
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
      .where(and(inArray(attachments.key, keys), or(isNull(attachments.postId), eq(attachments.postId, postId))));
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * 정리 작업 (FR-009): ① 붙지 않은 지(한 번도 안 붙었으면 올린 지) 하루 지난 첨부의 행과 파일
 * ② 행이 없는 저장소 파일 중 1시간 지난 것. 저장 중이라 잠긴 행은 건너뛴다.
 */
export async function cleanupAttachments({ dryRun = false, now = new Date() } = {}) {
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const stale = sql`${attachments.postId} is null and coalesce(${attachments.detachedAt}, ${attachments.createdAt}) < ${dayAgo.toISOString()}::timestamptz`;

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
