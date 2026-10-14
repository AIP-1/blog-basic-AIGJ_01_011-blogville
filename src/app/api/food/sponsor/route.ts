import { sponsorOcrState } from "@/server/food-ocr";

// 🍽 후기 카드가 부른다: 그림 속 협찬 표시를 다 읽었는지. ?u=글주소 (많아야 20개)
// 서버가 이미 줄 세운 글만 답하고, 여기서 새로 읽지는 않는다.
export function GET(req: Request) {
  const urls = new URL(req.url).searchParams.getAll("u").slice(0, 20);
  const states: Record<string, "pending" | "sponsored" | "none"> = {};
  for (const u of urls) {
    const s = sponsorOcrState(u);
    if (s) states[u] = s;
  }
  return Response.json({ states }, { headers: { "Cache-Control": "no-store" } });
}
