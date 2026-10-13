"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { KEY_PATTERN, PASTE_KEYS_MAX } from "@/lib/attachments";
import { parseId } from "@/lib/ids";
import { checkPostInput, rawPostInput } from "@/lib/post-rules";
import { classifyPasted, reuploadAttachment } from "@/server/attachments";
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
    postId = await storePost(blog.id, member.userId, checked.value);
  } catch (e) {
    if (e instanceof PostSaveError) return { error: e.message };
    throw e;
  }
  // 헤더의 Lv·🪙도 바뀔 수 있어 전체를 다시 그린다 (GAME-05)
  revalidatePath("/", "layout");
  // 새 글이면 글 상세 맨 위에 발행 안내를 한 번 보인다 (POST-01). 수정은 안내 없이 돌아간다
  redirect(`/@${blog.slug}/${postId}${checked.value.postId === null ? "?new=1" : ""}`);
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

/** 붙여 넣은 키 목록 검사: 1~50개, 모두 키 모양 */
function pastedKeys(keys: unknown): string[] | null {
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > PASTE_KEYS_MAX) return null;
  return keys.every((k) => typeof k === "string" && KEY_PATTERN.test(k)) ? [...new Set(keys as string[])] : null;
}

/** 붙여 넣은 첨부마다 keep / reupload / drop (POST-07 흐름 7) */
export async function classifyPastedAttachments(keys: unknown, postId: unknown) {
  const member = await requireMember();
  const list = pastedKeys(keys);
  if (!list) return null;
  return classifyPasted(member.userId, list, parseId(postId));
}

/** 내 다른 글의 첨부를 새 키로 다시 올린다. 새 키(keep이면 같은 키), 넣으면 안 되면 null */
export async function reuploadPastedAttachment(key: unknown, postId: unknown): Promise<string | null> {
  const member = await requireMember();
  if (typeof key !== "string" || !KEY_PATTERN.test(key)) return null;
  try {
    return await reuploadAttachment(member.userId, key, parseId(postId));
  } catch {
    return null;
  }
}
