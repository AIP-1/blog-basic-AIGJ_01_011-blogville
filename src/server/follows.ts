import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { follows } from "@/db/schema";

/** 블로그 홈의 `이웃 N`: 이 블로그 주인을 이웃 추가한 사람 수 (SOC-04) */
export async function countFollowers(ownerId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(follows).where(eq(follows.followeeId, ownerId));
  return row.n;
}

/** 내가 이 회원을 이웃 추가했는지 */
export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const [row] = await db
    .select({ n: count() })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
  return row.n > 0;
}

/**
 * 이웃 추가·취소 (SOC-04). 내 이웃 행이 있으면 지우고(취소), 없으면 넣는다.
 * 넣을 때는 상대가 블로그를 가진 회원일 때만 1행이 생긴다 (#22). 겹친 요청은 기본 키가 막는다.
 * 자기 자신은 부르는 쪽에서 거르고, 그래도 오면 CHECK가 거부한다.
 */
export async function toggleFollow(followerId: string, followeeId: string): Promise<void> {
  const removed = await db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)))
    .returning({ followeeId: follows.followeeId });
  if (removed.length > 0) return;
  try {
    await db.execute(sql`
      insert into follows (follower_id, followee_id)
      select ${followerId}, b.owner_id from blogs b where b.owner_id = ${followeeId}
      on conflict do nothing`);
  } catch (e) {
    // 그 순간 상대가 탈퇴해 외래 키가 깨지면 조용히 끝낸다
    if ((e as { cause?: { code?: string }; code?: string }).cause?.code === "23503" || (e as { code?: string }).code === "23503") return;
    throw e;
  }
}
