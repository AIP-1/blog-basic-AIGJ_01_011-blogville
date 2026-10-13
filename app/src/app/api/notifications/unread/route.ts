import { getSession } from "@/server/dal";
import { countUnreadNotifications, getPendingLevelUp } from "@/server/notifications";

// 헤더 🔔 숫자와 레벨업 팝업을 화면을 옮길 때마다 새로 받는다 (GAME-08·GAME-06). 방문자는 0, 팝업 없음.
export async function GET() {
  const member = await getSession();
  const [count, levelUp] = member ? await Promise.all([countUnreadNotifications(member.userId), getPendingLevelUp(member.userId)]) : [0, null];
  return Response.json({ count, levelUp }, { headers: { "Cache-Control": "no-store" } });
}
