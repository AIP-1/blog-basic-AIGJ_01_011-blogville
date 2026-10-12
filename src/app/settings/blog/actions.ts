"use server";

import { revalidatePath } from "next/cache";
import { BLOG_ERRORS, checkBlogIntro, checkBlogTitle } from "@/lib/blog-rules";
import { parseId } from "@/lib/ids";
import { getMyBlog, requireMember } from "@/server/dal";
import { updateBlogInfo as saveInfo, updateBlogSlug as saveSlug } from "@/server/blog";
import * as category from "@/server/category";

export type SettingsState = { error?: string; message?: string; values?: Record<string, string> } | null;

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

function refresh(slug: string) {
  revalidatePath("/settings/blog");
  revalidatePath(`/blog/${slug}`, "layout");
}

export async function updateBlogInfo(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const member = await requireMember();
  const values = { title: text(formData, "title"), intro: text(formData, "intro") };
  const error = checkBlogTitle(values.title) ?? checkBlogIntro(values.intro);
  if (error) return { error, values };
  await saveInfo(member.userId, values);
  refresh((await getMyBlog(member.userId)).slug);
  return { message: BLOG_ERRORS.saved };
}

export async function updateBlogSlug(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const member = await requireMember();
  const slug = text(formData, "slug");
  const result = await saveSlug(member.userId, slug, member.role);
  if ("error" in result) return { error: result.error, values: { slug } };
  refresh(result.oldSlug);
  refresh(result.slug);
  return { message: BLOG_ERRORS.saved, values: { slug: result.slug } };
}

// ── 카테고리 (BLOG-05) ──

export type CategoryState = { error?: string; values?: Record<string, string>; at?: string } | null;

const kindOf = (value: string): category.Kind | null => (value === "category" || value === "sub" ? value : null);

async function myBlog() {
  const member = await requireMember();
  return getMyBlog(member.userId);
}

export async function addCategory(_prev: CategoryState, formData: FormData): Promise<CategoryState> {
  const blog = await myBlog();
  const name = text(formData, "name");
  const parentId = text(formData, "categoryId");
  const at = parentId ? `sub-${parentId}` : "new";
  let error: string | null;
  if (parentId) {
    const id = parseId(parentId);
    error = id === null ? null : await category.addSubcategory(blog.id, id, name);
  } else {
    error = await category.addCategory(blog.id, name);
  }
  if (error) return { error, values: { name }, at };
  refresh(blog.slug);
  return { at };
}

export async function renameCategory(_prev: CategoryState, formData: FormData): Promise<CategoryState> {
  const blog = await myBlog();
  const kind = kindOf(text(formData, "kind"));
  const id = parseId(formData.get("id"));
  const name = text(formData, "name");
  const at = `rename-${text(formData, "kind")}-${text(formData, "id")}`;
  if (!kind || id === null) return { error: "잘못된 요청이에요", values: { name }, at };
  const error = await category.renameCategory(blog.id, kind, id, name);
  if (error) return { error, values: { name }, at };
  refresh(blog.slug);
  return { at, values: { done: "1" } };
}

export async function moveCategory(formData: FormData) {
  const blog = await myBlog();
  const kind = kindOf(text(formData, "kind"));
  const id = parseId(formData.get("id"));
  const direction = text(formData, "direction");
  if (!kind || id === null || (direction !== "-1" && direction !== "1")) return;
  await category.moveCategory(blog.id, kind, id, direction === "-1" ? -1 : 1);
  refresh(blog.slug);
}

export async function deleteCategory(formData: FormData) {
  const blog = await myBlog();
  const kind = kindOf(text(formData, "kind"));
  const id = parseId(formData.get("id"));
  if (!kind || id === null) return;
  await category.deleteCategory(blog.id, kind, id);
  refresh(blog.slug);
}
