"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { posts } from "@/db/schema";
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
