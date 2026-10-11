"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseId } from "@/lib/ids";
import { checkPostInput, rawPostInput } from "@/lib/post-rules";
import { getMyBlog, requireMember } from "@/server/dal";
import { deletePost as removePost, PostSaveError, savePost as storePost } from "@/server/post";

export type PostFormState = { error: string } | null;

export async function savePost(_prev: PostFormState, formData: FormData): Promise<PostFormState> {
  const member = await requireMember();
  const checked = checkPostInput(rawPostInput(formData));
  if (!checked.ok) return { error: checked.error };

  const blog = await getMyBlog(member.userId);
  let postId: number;
  try {
    postId = await storePost(blog.id, checked.value);
  } catch (e) {
    if (e instanceof PostSaveError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/blog/${blog.slug}`, "layout");
  redirect(`/@${blog.slug}/${postId}`);
}

export async function deletePost(formData: FormData) {
  const member = await requireMember();
  const postId = parseId(formData.get("postId"));
  if (postId === null) return;
  const blog = await getMyBlog(member.userId);
  await removePost(blog.id, postId);
  revalidatePath(`/blog/${blog.slug}`, "layout");
  redirect(`/@${blog.slug}`);
}
