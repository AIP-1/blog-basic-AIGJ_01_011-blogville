import "server-only";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { postLikes, posts } from "@/db/schema";
import { lockVisiblePost } from "./comments";
import { notifyActivity } from "./notifications";

/** 글 카드·상세의 `♥ N`: 글 주인 자신의 공감도 센다 (SOC-03) */
export function likeCountSql(postId: SQL | typeof posts.id): SQL<number> {
  return sql<number>`(select count(*) from ${postLikes} l where l.post_id = ${postId})::int`;
}

/** 글 상세: 공감 수와 내가 공감했는지 */
export async function getLikeState(postId: number, viewerId: string | null) {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      liked: sql<boolean>`coalesce(bool_or(${postLikes.userId} = ${viewerId ?? ""}), false)`,
    })
    .from(postLikes)
    .where(eq(postLikes.postId, postId));
  return row;
}

/**
 * 공감·취소 (SOC-03). 서버가 지금 상태를 보고 정한다: 내 공감이 있으면 지우고, 없으면 넣는다.
 * 볼 수 없는 글이면 아무것도 하지 않고 false. 새로 공감했으면 글 주인에게 공감 알림(GAME-08, 같은 사람·같은 글은 한 번만).
 * 보상(GAME-05)은 게임이 생기면 이 트랜잭션에 붙인다.
 */
export async function toggleLike(userId: string, postId: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    const ownerId = await lockVisiblePost(tx, userId, postId);
    if (ownerId === null) return false;
    const removed = await tx
      .delete(postLikes)
      .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
      .returning({ postId: postLikes.postId });
    if (removed.length > 0) return true;
    const added = await tx.insert(postLikes).values({ postId, userId }).onConflictDoNothing().returning({ postId: postLikes.postId });
    if (added.length > 0) await notifyActivity(tx, { kind: "like", recipientId: ownerId, actorId: userId, postId });
    return true;
  });
}
