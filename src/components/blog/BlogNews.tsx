import { getNews, newsEnabled } from "@/server/news";
import type { WidgetSize } from "@/lib/widgets";
import { NewsWidget } from "./NewsWidget";

/** 옆 칸 📰 오늘의 뉴스 (첫 화면 종합은 서버가 받아 그린다). 열쇠가 없으면 그리지 않는다. Suspense 안에서 쓴다 */
export async function BlogNews({ size }: { size: WidgetSize }) {
  if (!newsEnabled()) return null;
  return <NewsWidget initial={await getNews("all")} size={size} />;
}
