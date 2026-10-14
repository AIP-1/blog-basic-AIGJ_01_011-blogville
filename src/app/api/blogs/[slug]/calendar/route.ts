import { parseMonth } from "@/lib/calendar";
import { getPostCalendarBySlug } from "@/server/calendar";

// 📅 캘린더 위젯이 이전·다음 달로 넘길 때 부른다. 누구나 (공개 글만).
export async function GET(req: Request, ctx: RouteContext<"/api/blogs/[slug]/calendar">) {
  const { slug } = await ctx.params;
  const month = parseMonth(new URL(req.url).searchParams.get("month"));
  if (!month || !/^[a-z0-9_]{1,40}$/.test(slug)) return Response.json({ error: "bad request" }, { status: 400 });
  const data = await getPostCalendarBySlug(slug, month.year, month.month);
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(data, { headers: { "Cache-Control": "public, max-age=60" } });
}
