import { parseMonth } from "@/lib/calendar";
import { findBlogForCalendar, getCalendarMonth } from "@/server/calendar";
import { getSession } from "@/server/dal";

// 📅 캘린더 위젯이 달을 넘길 때 부른다: ?blog=주소&month=2026-10 → 그 달 날짜별 글. 주인이 아니면 공개 글만.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const slug = params.get("blog") ?? "";
  const month = parseMonth(params.get("month"));
  const blog = month && /^[a-z0-9_]{1,40}$/.test(slug) ? await findBlogForCalendar(slug) : null;
  if (!month || !blog) return Response.json({ error: "블로그나 달이 이상해요" }, { status: 400 });
  const member = await getSession();
  const data = await getCalendarMonth(blog.id, month, member?.userId === blog.ownerId);
  return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
