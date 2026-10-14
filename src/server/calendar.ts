import "server-only";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { blogs, posts } from "@/db/schema";
import { monthKey, shiftMonth, type CalendarMonth } from "@/lib/calendar";

/** 한 달에 많이 써도 위젯이 무겁지 않게 */
const MONTH_LIMIT = 300;

/** 📅 캘린더 위젯: 그 달(한국 날짜)에 쓴 공개 글을 날마다. 비공개·예약 글은 주인이 봐도 넣지 않는다 (같은 화면을 누가 보든 같게) */
export async function getPostCalendar(blogId: number, year: number, month: number): Promise<CalendarMonth> {
  const next = shiftMonth(year, month, 1);
  // 한국 자정 = UTC 전날 15시
  const from = new Date(Date.UTC(year, month - 1, 1) - 9 * 3_600_000);
  const to = new Date(Date.UTC(next.year, next.month - 1, 1) - 9 * 3_600_000);
  const rows = await db
    .select({ id: posts.id, title: posts.title, createdAt: posts.createdAt })
    .from(posts)
    .where(and(eq(posts.blogId, blogId), eq(posts.isPublic, true), gte(posts.createdAt, from), lt(posts.createdAt, to)))
    .orderBy(asc(posts.createdAt), asc(posts.id))
    .limit(MONTH_LIMIT);
  const days: CalendarMonth["days"] = {};
  for (const r of rows) {
    const day = new Date(r.createdAt.getTime() + 9 * 3_600_000).getUTCDate();
    (days[day] ??= []).push({ id: r.id, title: r.title });
  }
  return { month: monthKey(year, month), days };
}

export async function getPostCalendarBySlug(slug: string, year: number, month: number): Promise<CalendarMonth | null> {
  const [blog] = await db.select({ id: blogs.id }).from(blogs).where(eq(blogs.slug, slug)).limit(1);
  return blog ? getPostCalendar(blog.id, year, month) : null;
}
