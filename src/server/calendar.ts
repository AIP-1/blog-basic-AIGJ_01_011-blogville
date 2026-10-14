import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogs, posts } from "@/db/schema";
import type { CalendarMonth, CalendarPost } from "@/lib/calendar";

// 📅 캘린더 위젯: 한 달 동안 그 블로그에 쓴 글을 한국 날짜별로. 주인이 아니면 공개 글만.
// 하루에 많이 써도 앞의 몇 개만 (위젯 안 목록)
const PER_DAY = 5;

/** 그 달(`2026-10`)에 쓴 글 (날짜별, 쓴 순서) */
export async function getCalendarMonth(blogId: number, month: string, viewerIsOwner: boolean): Promise<CalendarMonth> {
  const day = sql<string>`to_char(${posts.createdAt} at time zone 'Asia/Seoul', 'YYYY-MM-DD')`;
  // 한국 시간 그 달 1일 0시 ~ 다음 달 1일 0시 (posts_blog_list_idx를 쓴다)
  const from = sql`(${`${month}-01`}::date::timestamp at time zone 'Asia/Seoul')`;
  const to = sql`((${`${month}-01`}::date + interval '1 month')::timestamp at time zone 'Asia/Seoul')`;
  const rows = await db
    .select({ id: posts.id, title: posts.title, day })
    .from(posts)
    .where(
      and(
        eq(posts.blogId, blogId),
        viewerIsOwner ? undefined : eq(posts.isPublic, true),
        sql`${posts.createdAt} >= ${from}`,
        sql`${posts.createdAt} < ${to}`,
      ),
    )
    .orderBy(asc(posts.createdAt), asc(posts.id))
    .limit(500);
  const days: Record<string, CalendarPost[]> = {};
  for (const r of rows) {
    const list = (days[r.day] ??= []);
    if (list.length < PER_DAY) list.push({ id: r.id, title: r.title });
  }
  return { month, days };
}

/** 주소로 블로그 id·주인 */
export async function findBlogForCalendar(slug: string) {
  const [row] = await db.select({ id: blogs.id, ownerId: blogs.ownerId }).from(blogs).where(eq(blogs.slug, slug)).limit(1);
  return row ?? null;
}
