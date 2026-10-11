import "server-only";
import { and, count, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogVisits, posts, postViews } from "@/db/schema";
import { previousDay, todayKST } from "@/lib/kst";

export type VisitStats = { today: number; yesterday: number; total: number };

/** 블로그 방문자 오늘·어제·전체 (BLOG-06). 기본 키 인덱스(blog_id가 맨 앞)를 쓴다. */
export async function getBlogVisitStats(blogId: number): Promise<VisitStats> {
  const today = todayKST();
  const [row] = await db
    .select({
      today: sql<number>`count(*) filter (where ${blogVisits.date} = ${today})::int`,
      yesterday: sql<number>`count(*) filter (where ${blogVisits.date} = ${previousDay(today)})::int`,
      total: count(),
    })
    .from(blogVisits)
    .where(eq(blogVisits.blogId, blogId));
  return row;
}

/** 이 브라우저가 오늘 이 블로그를 처음 왔으면 1번 남긴다 */
export async function recordVisit(blogId: number, visitorId: string) {
  await db.insert(blogVisits).values({ blogId, date: todayKST(), visitorId }).onConflictDoNothing();
}

/** 오늘 이 브라우저로 이 글을 센 적이 있나 */
export async function hasViewedToday(postId: number, visitorId: string | null): Promise<boolean> {
  if (!visitorId) return false;
  const [row] = await db
    .select({ one: sql`1` })
    .from(postViews)
    .where(and(eq(postViews.postId, postId), eq(postViews.date, todayKST()), eq(postViews.visitorId, visitorId)))
    .limit(1);
  return row !== undefined;
}

/**
 * 조회 기록 (POST-06): 오늘 처음이면 기록하고 +1. 기록과 +1이 한 트랜잭션이라 빠지는 수가 없다.
 * 조회수가 바뀌어도 글의 수정 시각은 그대로 둔다. 지금 조회수를 돌려준다.
 */
export async function recordView(postId: number, visitorId: string): Promise<number> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(postViews)
      .values({ postId, date: todayKST(), visitorId })
      .onConflictDoNothing()
      .returning({ postId: postViews.postId });
    if (inserted.length > 0) {
      const [row] = await tx
        .update(posts)
        .set({ viewCount: sql`${posts.viewCount} + 1`, updatedAt: sql`${posts.updatedAt}` })
        .where(eq(posts.id, postId))
        .returning({ viewCount: posts.viewCount });
      return row.viewCount;
    }
    const [row] = await tx.select({ viewCount: posts.viewCount }).from(posts).where(eq(posts.id, postId));
    return row.viewCount;
  });
}

/** 하루 1번 판단에는 오늘·어제 줄만 필요하다. 조회수 합계는 그대로 둔다. */
export async function cleanupPostViews({ dryRun }: { dryRun: boolean }): Promise<number> {
  const before = previousDay(todayKST());
  if (dryRun) {
    const [row] = await db.select({ n: count() }).from(postViews).where(lt(postViews.date, before));
    return row.n;
  }
  const rows = await db.delete(postViews).where(lt(postViews.date, before)).returning({ postId: postViews.postId });
  return rows.length;
}
