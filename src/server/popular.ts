import "server-only";
import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogs, categories, comments, postLikes, posts, postViews, profiles, subcategories } from "@/db/schema";
import { comparePopular, POPULAR_LIMIT, POPULAR_WEIGHTS, popularWindow, type PopularRange } from "@/lib/popular";
import { commentCountSql } from "./comments";
import { likeCountSql } from "./likes";
import { cached } from "./ttl-cache";

/** 보이는 글만: 공개, 블라인드 아님, 예약 시각이 지난 글 (블라인드·예약 글은 비공개로만 있지만 한 번 더 막는다) */
const visible = sql`p.is_public and p.blinded_at is null and (p.publish_at is null or p.publish_at <= now())`;

/**
 * 🔥 인기 글: 기간 안에 쓰였거나 읽힌·공감받은·댓글이 달린 공개 글을 점수 순으로 30개.
 * 점수 = 그 기간의 조회 기록(post_views, 방문자마다 하루 1행) + 공감 × 3 + 지우지 않은 댓글 × 2.
 * 같으면 새 글이 먼저.
 *
 * 순위(글 번호와 점수)만 5분 기억한다: 기간 안의 조회 기록·공감·댓글을 모두 묶어 세는 일이 기록이 쌓이면
 * 가장 무거워서다(글 20만·조회 100만에서 약 1초). 카드 내용은 매번 다시 읽고 보이는 글인지도 다시 보므로,
 * 글을 비공개로 돌리거나 블라인드하면 기억과 상관없이 바로 빠진다.
 */
const POPULAR_CACHE_MS = 5 * 60_000;

export async function listPopular(range: PopularRange, now = new Date()) {
  const { startDay, startAt } = popularWindow(range, now);
  const since = startAt.toISOString();
  const ranked = await cached(`popular:${range}:${startDay}`, POPULAR_CACHE_MS, () => db.execute<{ id: number; score: number }>(sql`
    with v as (
      select post_id, count(*)::int as n from ${postViews} where date >= ${startDay}::date group by post_id
    ), l as (
      select post_id, count(*)::int as n from ${postLikes} where created_at >= ${since}::timestamptz group by post_id
    ), c as (
      select post_id, count(*)::int as n from ${comments}
      where created_at >= ${since}::timestamptz and deleted_at is null group by post_id
    ), cand as (
      select post_id from v union select post_id from l union select post_id from c
      union select id from ${posts} where created_at >= ${since}::timestamptz
    )
    select p.id,
      (coalesce(v.n, 0) * ${POPULAR_WEIGHTS.view} + coalesce(l.n, 0) * ${POPULAR_WEIGHTS.like}
        + coalesce(c.n, 0) * ${POPULAR_WEIGHTS.comment})::int as score
    from cand join ${posts} p on p.id = cand.post_id
    left join v on v.post_id = p.id left join l on l.post_id = p.id left join c on c.post_id = p.id
    where ${visible}
    order by score desc, p.created_at desc, p.id desc
    limit ${POPULAR_LIMIT}
  `));
  if (ranked.length === 0) return [];
  const scores = new Map(ranked.map((r) => [Number(r.id), Number(r.score)]));
  // 마을 소식과 같은 카드 내용. 순위를 센 뒤 바뀌었을 수 있어 보이는 글인지 한 번 더 본다
  const rows = await db
    .select({
      post: posts,
      commentCount: commentCountSql(posts.id),
      likeCount: likeCountSql(posts.id),
      categoryName: categories.name,
      subcategoryName: subcategories.name,
      blogSlug: blogs.slug,
      blogTitle: blogs.title,
      nickname: profiles.nickname,
    })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .leftJoin(categories, eq(categories.id, posts.categoryId))
    .leftJoin(subcategories, eq(subcategories.id, posts.subcategoryId))
    .where(
      and(
        inArray(posts.id, [...scores.keys()]),
        eq(posts.isPublic, true),
        isNull(posts.blindedAt),
        or(isNull(posts.publishAt), lte(posts.publishAt, now)),
      ),
    );
  return rows
    .map((row) => ({ ...row, score: scores.get(row.post.id)! }))
    .sort((a, b) => comparePopular({ id: a.post.id, score: a.score, createdAt: a.post.createdAt }, { id: b.post.id, score: b.score, createdAt: b.post.createdAt }));
}
