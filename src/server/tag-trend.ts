import "server-only";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { posts, postTags, tags } from "@/db/schema";
import { TREND_KEYWORD_LEN, type TrendResult } from "@/lib/keyword-trend";
import { getKeywordTrend } from "./keyword-trend";

/** 📊 내 태그 인기 흐름: 내 블로그에서 가장 많이 쓴 태그 5개(비공개 글 포함)와 그 1년 네이버 검색 관심도 */
export async function getMyTagTrend(blogId: number): Promise<{ tags: string[]; trend: TrendResult | null }> {
  const uses = count(postTags.postId);
  const rows = await db
    .select({ name: tags.name })
    .from(tags)
    .innerJoin(postTags, eq(postTags.tagId, tags.id))
    .innerJoin(posts, and(eq(posts.id, postTags.postId), eq(posts.blogId, blogId)))
    .groupBy(tags.id)
    .orderBy(desc(uses), asc(tags.name))
    .limit(5);
  const names = rows.map((r) => r.name).filter((n) => [...n].length <= TREND_KEYWORD_LEN);
  if (names.length === 0) return { tags: [], trend: null };
  return { tags: names, trend: await getKeywordTrend(names, "y1") };
}
