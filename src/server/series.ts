import "server-only";
import { and, asc, eq, notExists, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { posts, series } from "@/db/schema";
import type { SeriesChoice } from "@/lib/post-rules";

// 시리즈 (개선 12): 블로그 안의 연재 묶음. 글쓰기에서 고르거나 새로 만들고, 글이 하나도 없으면 지운다.

/** 글쓰기 화면의 시리즈 고르기 */
export async function getSeriesOptions(blogId: number) {
  return db.select({ id: series.id, title: series.title }).from(series).where(eq(series.blogId, blogId)).orderBy(asc(series.title));
}

/** 고른 시리즈 → 글에 넣을 series_id. 남의 블로그 시리즈 번호면 "invalid" */
export async function resolveSeries(tx: Tx, blogId: number, choice: SeriesChoice): Promise<number | null | "invalid"> {
  if (choice.kind === "none") return null;
  if (choice.kind === "existing") {
    const [row] = await tx.select({ id: series.id }).from(series).where(and(eq(series.id, choice.id), eq(series.blogId, blogId))).for("share");
    return row?.id ?? "invalid";
  }
  // 같은 이름이 이미 있으면 그 시리즈에 넣는다
  await tx.insert(series).values({ blogId, title: choice.title }).onConflictDoNothing();
  const [row] = await tx.select({ id: series.id }).from(series).where(and(eq(series.blogId, blogId), eq(series.title, choice.title))).for("share");
  return row.id;
}

/** 글이 하나도 남지 않은 시리즈를 지운다 (글을 빼거나 지운 뒤) */
export async function removeEmptySeries(tx: Tx | typeof db, blogId: number) {
  await tx
    .delete(series)
    .where(and(eq(series.blogId, blogId), notExists(tx.select({ one: sql`1` }).from(posts).where(eq(posts.seriesId, series.id)))));
}

/** 글 화면의 시리즈 상자: 이름과 보는 사람이 볼 수 있는 글(날짜순) */
export async function getSeriesNav(seriesId: number, viewerIsOwner: boolean) {
  const [head] = await db.select({ id: series.id, title: series.title }).from(series).where(eq(series.id, seriesId)).limit(1);
  if (!head) return null;
  const items = await db
    .select({ id: posts.id, title: posts.title })
    .from(posts)
    .where(and(eq(posts.seriesId, seriesId), viewerIsOwner ? undefined : eq(posts.isPublic, true)))
    .orderBy(asc(posts.createdAt), asc(posts.id));
  return { ...head, items };
}
