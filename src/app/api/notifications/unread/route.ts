import { getSession } from "@/server/dal";
import { countUnreadNotifications } from "@/server/notifications";

// 헤더 🔔 숫자를 화면을 옮길 때마다 새로 받는다 (GAME-08). 방문자는 0.
export async function GET() {
  const member = await getSession();
  const count = member ? await countUnreadNotifications(member.userId) : 0;
  return Response.json({ count }, { headers: { "Cache-Control": "no-store" } });
}
