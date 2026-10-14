import { getSession } from "@/server/dal";
import { searchStocks } from "@/server/stocks";

// 블로그 설정의 관심 종목 검색 (로그인한 회원만). 국내·미국 주식, 최대 10개
export async function GET(req: Request) {
  if (!(await getSession())) return Response.json({ items: [] }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const items = await searchStocks(q);
  return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
}
