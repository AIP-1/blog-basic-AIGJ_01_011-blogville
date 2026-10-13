import { getSession } from "@/server/dal";

// 시험 오류 (관리자 ⚠️ 오류 화면의 [시험 오류 만들기]): 관리자만, 아무것도 바꾸지 않고 오류만 던진다.
// onRequestError가 기록하는지 E2E로 확인하는 용도. 관리자가 아니면 404.
export async function POST() {
  const member = await getSession();
  if (member?.role !== "admin") return new Response("Not Found", { status: 404 });
  throw new Error("시험 오류");
}
