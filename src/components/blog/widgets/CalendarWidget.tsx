import { todayKST } from "@/lib/kst";
import { getCalendarMonth } from "@/server/calendar";
import { CalendarBoard } from "./CalendarBoard";

/** 📅 캘린더 (위젯 보드): 이번 달 글 쓴 날을 서버에서 받아 그린다. 달을 넘기면 /api/calendar */
export async function CalendarWidget({ blog, isOwner = false }: { blog: { id: number; slug: string }; isOwner?: boolean }) {
  const today = todayKST();
  const initial = await getCalendarMonth(blog.id, today.slice(0, 7), isOwner);
  return <CalendarBoard slug={blog.slug} today={today} initial={initial} />;
}
