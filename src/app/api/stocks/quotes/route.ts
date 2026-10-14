import { getQuotes, listStocksBySlug } from "@/server/stocks";

// 블로그 📈 관심 종목 위젯이 화면을 열어 둔 동안 5초마다 부른다. 누구나 (방문자도 본다).
// 종목은 그 블로그에 저장된 것만 — 아무 종목이나 대신 받아 주는 길이 되지 않게 한다.
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("blog") ?? "";
  const items = /^[a-z0-9_]{1,40}$/.test(slug) ? await listStocksBySlug(slug) : [];
  const quotes = await getQuotes(items);
  return Response.json({ quotes, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
