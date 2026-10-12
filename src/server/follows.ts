import "server-only";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogs, follows, posts, profiles } from "@/db/schema";

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

/** 내 이웃 목록은 이만큼만 보여 준다 (최근 공개 글 순) */
export const NEIGHBOR_LIST_LIMIT = 200;

export type Neighbor = { userId: string; slug: string; blogTitle: string; nickname: string; postCount: number; mutual: boolean };

/**
 * 이웃 새 글 위 `내 이웃 N` (SOC-04 열린 질문의 제안): 내가 이웃 추가한 회원의 블로그.
 * 최근 공개 글 순(공개 글이 없으면 뒤로, 그다음 닉네임 순). 공개 글 수와 `서로 이웃`(상대도 나를 이웃 추가) 여부를 함께.
 */
export async function listMyNeighbors(userId: string): Promise<{ items: Neighbor[]; total: number }> {
  const lastPublic = sql`(select max(p.created_at) from ${posts} p where p.blog_id = ${blogs.id} and p.is_public)`;
  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        userId: follows.followeeId,
        slug: blogs.slug,
        blogTitle: blogs.title,
        nickname: profiles.nickname,
        postCount: sql<number>`(select count(*) from ${posts} p where p.blog_id = ${blogs.id} and p.is_public)::int`,
        mutual: sql<boolean>`exists (select 1 from ${follows} back where back.follower_id = ${follows.followeeId} and back.followee_id = ${userId})`,
      })
      .from(follows)
      .innerJoin(blogs, eq(blogs.ownerId, follows.followeeId))
      .innerJoin(profiles, eq(profiles.userId, follows.followeeId))
      .where(eq(follows.followerId, userId))
      .orderBy(sql`${lastPublic} desc nulls last`, asc(profiles.nickname), asc(blogs.slug))
      .limit(NEIGHBOR_LIST_LIMIT),
    db.select({ total: count() }).from(follows).where(eq(follows.followerId, userId)),
  ]);
  return { items, total };
}

/** 이웃 취소만 한다 (내 이웃 목록의 [✓ 이웃]). 겹쳐 눌러도 다시 추가되지 않는다 */
export async function unfollow(followerId: string, followeeId: string): Promise<void> {
  await db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
}
