import "server-only";
import { and, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { blogs, posts, postTags, profiles, tags } from "@/db/schema";
import { weekRange, type WeeklyPrompt } from "@/lib/town/prompts";

// 이번 주 글감의 '이웃의 답장' (plaza-upgrade-2, C1)

/** 답장 목록은 이만큼까지 */
export const PROMPT_ANSWERS = 30;

export type PromptAnswer = { id: number; title: string; createdAt: Date; slug: string; nickname: string; photoKey: string | null };

/**
 * 그 주(월요일 0시 KST부터 7일)에 글감 태그로 쓴 공개·블라인드 아닌 글, 최신순.
 * posts ⋈ post_tags ⋈ tags(이름 고유) ⋈ blogs ⋈ profiles 쿼리 하나로 읽는다.
 */
export async function getPromptAnswers(prompt: Pick<WeeklyPrompt, "key" | "tag">, limit = PROMPT_ANSWERS): Promise<PromptAnswer[]> {
  const { start, end } = weekRange(prompt.key);
  return db
    .select({ id: posts.id, title: posts.title, createdAt: posts.createdAt, slug: blogs.slug, nickname: profiles.nickname, photoKey: profiles.photoKey })
    .from(tags)
    .innerJoin(postTags, eq(postTags.tagId, tags.id))
    .innerJoin(posts, eq(posts.id, postTags.postId))
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .where(and(eq(tags.name, prompt.tag), eq(posts.isPublic, true), isNull(posts.blindedAt), gte(posts.createdAt, start), lt(posts.createdAt, end)))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit);
}
