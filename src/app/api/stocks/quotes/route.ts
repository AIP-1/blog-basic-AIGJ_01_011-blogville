import { isStockIndex } from "@/lib/stocks";
import { getIndex, getQuotes, listStocksBySlug } from "@/server/stocks";

// 블로그 📈 증시 위젯: 실시간 스트림이 조용할 때 한 번 직접 묻는 길. 누구나 (방문자도 본다).
// 종목은 그 블로그에 저장된 것만 — 아무 종목이나 대신 받아 주는 길이 되지 않게 한다. 지수는 코스피·코스닥 중 ?index=.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const slug = params.get("blog") ?? "";
  const indexParam = params.get("index");
  const items = /^[a-z0-9_]{1,40}$/.test(slug) ? await listStocksBySlug(slug) : [];
  const [quotes, index] = await Promise.all([getQuotes(items), getIndex(isStockIndex(indexParam) ? indexParam : "KOSPI")]);
  return Response.json({ quotes, index, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
