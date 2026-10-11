"use server";

import { revalidatePath } from "next/cache";
import { parseId } from "@/lib/ids";
import { getMyBlog, requireMember } from "@/server/dal";
import { deletePost, setPostVisibility } from "@/server/post";

// 글 관리 (BLOG-08). 남의 글·없는 글·이상한 값이면 아무것도 바꾸지 않는다.

export async function changeVisibility(formData: FormData) {
  const member = await requireMember();
  const postId = parseId(formData.get("postId"));
  const to = formData.get("to");
  if (postId === null || (to !== "public" && to !== "private")) return;
  const blog = await getMyBlog(member.userId);
  if (await setPostVisibility(blog.id, postId, to === "public")) revalidatePath("/", "layout");
}

export async function removePost(formData: FormData) {
  const member = await requireMember();
  const postId = parseId(formData.get("postId"));
  if (postId === null) return;
  const blog = await getMyBlog(member.userId);
  await deletePost(blog.id, postId);
  revalidatePath("/", "layout");
}
