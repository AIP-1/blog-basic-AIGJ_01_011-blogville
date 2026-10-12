"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { blogs, posts } from "@/db/schema";
import { parseId } from "@/lib/ids";
import { requireAdmin } from "@/server/dal";

/** 관리자 글 삭제 (AUTH-08): 어느 블로그의 글이든 지운다. 일반 회원이 보내면 404로 끝나고 아무것도 지우지 않는다. */
export async function adminDeletePost(formData: FormData): Promise<void> {
  await requireAdmin();
  const postId = parseId(formData.get("postId"));
  if (postId === null) return;
  await db.delete(posts).where(eq(posts.id, postId));
  revalidatePath("/", "layout");
}

/**
 * 글 화면의 관리자 [삭제] (AUTH-08 열린 질문): `/admin` 최근 글에 없는 오래된 글도 지운다.
 * 지운 글 화면은 404라 그 블로그 홈으로 보낸다. 이미 지워진 글이면 다시 그리기만 한다.
 */
export async function adminDeletePostAndLeave(formData: FormData): Promise<void> {
  await requireAdmin();
  const postId = parseId(formData.get("postId"));
  if (postId === null) return;
  const [deleted] = await db.delete(posts).where(eq(posts.id, postId)).returning({ blogId: posts.blogId });
  revalidatePath("/", "layout");
  if (!deleted) return;
  const [blog] = await db.select({ slug: blogs.slug }).from(blogs).where(eq(blogs.id, deleted.blogId));
  if (blog) redirect(`/@${blog.slug}`);
}
