import { isNewsTab } from "@/lib/news";
import { getNews, newsEnabled } from "@/server/news";

// 📰 뉴스 위젯이 탭을 바꾸거나 10분마다 부른다. 누구나. 탭은 정해 둔 것만 (아무 검색어나 대신 받아 주는 길이 되지 않게).
export async function GET(req: Request) {
  const tab = new URL(req.url).searchParams.get("tab");
  if (!isNewsTab(tab)) return Response.json({ error: "bad request" }, { status: 400 });
  if (!newsEnabled()) return Response.json({ error: "disabled" }, { status: 404 });
  const news = await getNews(tab);
  if (!news) return Response.json({ error: "unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  return Response.json(news, { headers: { "Cache-Control": "public, max-age=120" } });
}
