import { getIndex, getQuotes, listBlogStocks } from "@/server/stocks";
import type { WidgetSize } from "@/lib/widgets";
import { StockWidget } from "./StockWidget";

/** 옆 칸 📈 증시 (서버에서 첫 시세·코스피를 받아 그린다). Suspense 안에서 쓴다 — 시세를 기다리느라 블로그 홈이 늦게 뜨지 않게 */
export async function BlogStocks({ blogId, slug, isOwner, size }: { blogId: number; slug: string; isOwner: boolean; size: WidgetSize }) {
  const items = await listBlogStocks(blogId);
  const [quotes, index] = await Promise.all([getQuotes(items), getIndex("KOSPI")]);
  return <StockWidget slug={slug} initial={quotes} initialIndex={index} isOwner={isOwner} size={size} />;
}
