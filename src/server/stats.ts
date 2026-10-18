import "server-only";
import { and, count, desc, eq, gte, lt, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { db } from "@/db";
import { blogReferrers, blogVisits, posts, postViews } from "@/db/schema";
import { fillDays, lastDays, previousDay, todayKST } from "@/lib/kst";

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

/** 블로그 관리의 최근 7일 방문자 (BLOG-06). 오래된 날부터 7칸, 기록이 없는 날은 0. */
export async function getBlogVisitDays(blogId: number) {
  const days = lastDays(todayKST(), 7);
  const rows = await db
    .select({ date: blogVisits.date, count: sql<number>`count(*)::int` })
    .from(blogVisits)
    .where(and(eq(blogVisits.blogId, blogId), gte(blogVisits.date, days[0])))
    .groupBy(blogVisits.date);
  return fillDays(days, rows);
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
 * 이 브라우저(방문자 쿠키)가 오늘·어제 이 글을 읽었나 (광장의 읽은 새 글, plaza-upgrade-2). 글 목록 쿼리의 한 칸으로 넣어
 * 따로 왕복하지 않는다(페이지의 Promise.all 안 쿼리에 그대로 실린다). post_views 기본 키(post_id, date, visitor_id)를 탄다.
 * 오늘·어제치만 남으므로(`cleanupPostViews`) 그보다 오래 전에 읽은 글은 안 읽은 것으로 보인다. 쿠키가 없으면 늘 false.
 */
export function viewedRecently(postId: SQLWrapper, visitorId: string | null): SQL<boolean> {
  if (!visitorId) return sql<boolean>`false`;
  const since = previousDay(todayKST());
  return sql<boolean>`exists (select 1 from ${postViews} v where v.post_id = ${postId} and v.date >= ${since}::date and v.visitor_id = ${visitorId}::uuid)`;
}

/**
 * 조회 기록 (POST-06): 오늘 처음이면 기록하고 +1. 기록과 +1이 한 트랜잭션이라 빠지는 수가 없다.
 * 조회수가 바뀌어도 글의 수정 시각은 그대로 둔다. 지금 조회수와 이번에 셌는지를 돌려준다.
 */
export async function recordView(postId: number, visitorId: string): Promise<{ viewCount: number; counted: boolean }> {
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
      return { viewCount: row.viewCount, counted: true };
    }
    const [row] = await tx.select({ viewCount: posts.viewCount }).from(posts).where(eq(posts.id, postId));
    return { viewCount: row.viewCount, counted: false };
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

/** 글 유입 경로 (통계 상세): 그날 그 출처로 들어온 첫 조회를 1 더한다 */
export async function recordReferrer(blogId: number, source: string) {
  await db
    .insert(blogReferrers)
    .values({ blogId, date: todayKST(), source, count: 1 })
    .onConflictDoUpdate({ target: [blogReferrers.blogId, blogReferrers.date, blogReferrers.source], set: { count: sql`${blogReferrers.count} + 1` } });
}

/** 최근 n일 유입 경로: 많은 순 10개와 전체 합 */
export async function getReferrerStats(blogId: number, days = 30) {
  const since = lastDays(todayKST(), days)[0];
  const where = and(eq(blogReferrers.blogId, blogId), gte(blogReferrers.date, since));
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ source: blogReferrers.source, count: sql<number>`sum(${blogReferrers.count})::int` })
      .from(blogReferrers)
      .where(where)
      .groupBy(blogReferrers.source)
      .orderBy(desc(sql`sum(${blogReferrers.count})`), blogReferrers.source)
      .limit(10),
    db.select({ total: sql<number>`coalesce(sum(${blogReferrers.count}), 0)::int` }).from(blogReferrers).where(where),
  ]);
  return { rows, total };
}

/** 인기 글: 공개 글 조회수 순 */
export async function getPopularPosts(blogId: number, limit = 10) {
  return db
    .select({ id: posts.id, title: posts.title, viewCount: posts.viewCount })
    .from(posts)
    .where(and(eq(posts.blogId, blogId), eq(posts.isPublic, true), sql`${posts.viewCount} > 0`))
    .orderBy(desc(posts.viewCount), desc(posts.id))
    .limit(limit);
}
