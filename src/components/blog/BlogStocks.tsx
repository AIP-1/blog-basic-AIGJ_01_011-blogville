import { getQuotes, listBlogStocks } from "@/server/stocks";
import type { WidgetSize } from "@/lib/widgets";
import { StockWidget } from "./StockWidget";

/** 옆 칸 📈 관심 종목 (서버에서 첫 시세를 받아 그린다). 종목이 없으면 주인에게만 안내가 보인다. Suspense 안에서 쓴다 — 시세를 기다리느라 블로그 홈이 늦게 뜨지 않게 */
export async function BlogStocks({ blogId, slug, isOwner, size }: { blogId: number; slug: string; isOwner: boolean; size: WidgetSize }) {
  const items = await listBlogStocks(blogId);
  if (items.length === 0 && !isOwner) return null;
  const quotes = await getQuotes(items);
  return <StockWidget slug={slug} initial={quotes} isOwner={isOwner} size={size} />;
}
