"use server";

import { revalidatePath } from "next/cache";
import { checkComment, COMMENT_ERRORS } from "@/lib/comment-rules";
import { parseId } from "@/lib/ids";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blogs, posts } from "@/db/schema";
import { createComment, createReply, removeComment, removeReply } from "@/server/comments";
import { getSession, requireMember } from "@/server/dal";
import { toggleFavorite, toggleFollow as storeFollow, unfollow } from "@/server/follows";
import { FAVORITE_MESSAGES } from "@/lib/social";
import { toggleLike as storeLike } from "@/server/likes";
import { getBlogVisitStats, recordView, recordVisit, type VisitStats } from "@/server/stats";
import { ensureVisitorId } from "@/server/visitor";

// 댓글·답글 (SOC-01·02, specs/004-comments). 실패하면 문구만 돌려주고 입력은 화면에 남는다.

export type CommentResult = { ok: true } | { ok: false; error: string };

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

export async function addComment(formData: FormData): Promise<CommentResult> {
  const member = await requireMember();
  const postId = parseId(formData.get("postId"));
  if (postId === null) return { ok: false, error: COMMENT_ERRORS.invalid };
  const checked = checkComment(text(formData, "content"));
  if (!checked.ok) return checked;
  const result = await createComment(member.userId, postId, checked.content);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function addReply(formData: FormData): Promise<CommentResult> {
  const member = await requireMember();
  const postId = parseId(formData.get("postId"));
  const commentId = parseId(formData.get("commentId"));
  if (postId === null || commentId === null) return { ok: false, error: COMMENT_ERRORS.invalid };
  const checked = checkComment(text(formData, "content"));
  if (!checked.ok) return checked;
  const result = await createReply(member.userId, postId, commentId, checked.content);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** 지울 권한이 없거나 이상한 ID면 아무것도 바꾸지 않는다 (문구 없음) */
export async function deleteComment(formData: FormData): Promise<void> {
  const member = await requireMember();
  const id = parseId(formData.get("id"));
  if (id === null) return;
  if ((await removeComment(member, id)) !== null) revalidatePath("/", "layout");
}

export async function deleteReply(formData: FormData): Promise<void> {
  const member = await requireMember();
  const id = parseId(formData.get("id"));
  if (id === null) return;
  if ((await removeReply(member, id)) !== null) revalidatePath("/", "layout");
}

// 조회수·방문자 (POST-06, BLOG-06). 화면이 브라우저에 열릴 때 한 번 부른다.
// 방문자도 부르므로 로그인 검사가 없다. 주인인지는 여기서 다시 본다.
// revalidatePath는 부르지 않는다: 돌려준 숫자로 그 자리만 바꾼다.

/** 글 상세: 조회수 +1(오늘 처음이면)과 그 블로그 방문 기록. 지금 조회수, 셀 수 없는 글이면 null. */
export async function recordPostView(rawPostId: unknown): Promise<number | null> {
  const postId = parseId(rawPostId);
  if (postId === null) return null;
  const [row] = await db
    .select({ blogId: posts.blogId, isPublic: posts.isPublic, viewCount: posts.viewCount, ownerId: blogs.ownerId })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .where(eq(posts.id, postId));
  if (!row || !row.isPublic) return null;
  const member = await getSession();
  if (member?.userId === row.ownerId) return row.viewCount;
  const visitorId = await ensureVisitorId();
  await recordVisit(row.blogId, visitorId);
  return recordView(postId, visitorId);
}

/** 블로그 홈: 오늘 처음 온 브라우저면 1번 기록하고 지금 숫자. 없는 블로그면 null. */
export async function recordBlogVisit(rawBlogId: unknown): Promise<VisitStats | null> {
  const blogId = parseId(rawBlogId);
  if (blogId === null) return null;
  const [blog] = await db.select({ ownerId: blogs.ownerId }).from(blogs).where(eq(blogs.id, blogId));
  if (!blog) return null;
  const member = await getSession();
  if (member?.userId !== blog.ownerId) await recordVisit(blogId, await ensureVisitorId());
  return getBlogVisitStats(blogId);
}

/** 공감·취소 (SOC-03). 공감인지 취소인지는 서버가 정한다. 볼 수 없는 글·이상한 ID는 아무것도 하지 않는다. */
export async function toggleLike(rawPostId: unknown): Promise<void> {
  const member = await requireMember();
  const postId = parseId(rawPostId);
  if (postId === null) return;
  if (await storeLike(member.userId, postId)) revalidatePath("/", "layout");
}

/**
 * 이웃 추가·취소 (SOC-04). 상대 회원 ID(블로그 주인)를 받는다.
 * 1~64자 문자열이 아니거나 나 자신이면 아무것도 하지 않는다 (#22). 블로그가 없는 회원은 저장되지 않는다.
 */
export async function toggleFollow(formData: FormData): Promise<void> {
  const member = await requireMember();
  const followeeId = formData.get("followeeId");
  if (typeof followeeId !== "string" || followeeId.length < 1 || followeeId.length > 64) return;
  if (followeeId === member.userId) return;
  await storeFollow(member.userId, followeeId);
  revalidatePath("/", "layout");
}

/**
 * 내 이웃 목록의 [✓ 이웃] (SOC-04): 취소만 한다. 확인 창은 화면에서 띄운다.
 * 1~64자 문자열이 아니면 아무것도 하지 않는다. 이웃이 아닌 값이면 지울 행이 없다.
 */
export async function removeNeighbor(formData: FormData): Promise<void> {
  const member = await requireMember();
  const followeeId = formData.get("followeeId");
  if (typeof followeeId !== "string" || followeeId.length < 1 || followeeId.length > 64) return;
  await unfollow(member.userId, followeeId);
  revalidatePath("/", "layout");
}

/**
 * 내 이웃 목록의 ☆/⭐ (TOWN-08 즐겨찾는 이웃): 켜기·끄기. 1~64자 문자열이 아니면 `이웃을 찾을 수 없어요.`
 * 거절하면 문구를 돌려주고 저장하지 않는다.
 */
export async function favoriteNeighbor(formData: FormData): Promise<{ error: string | null }> {
  const member = await requireMember();
  const followeeId = formData.get("followeeId");
  if (typeof followeeId !== "string" || followeeId.length < 1 || followeeId.length > 64) return { error: FAVORITE_MESSAGES.notFound };
  const error = await toggleFavorite(member.userId, followeeId);
  if (!error) revalidatePath("/", "layout");
  return { error };
}
