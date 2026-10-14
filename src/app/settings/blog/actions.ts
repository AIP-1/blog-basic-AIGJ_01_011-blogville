"use server";

import { revalidatePath } from "next/cache";
import { BLOG_ERRORS, checkBlogIntro, checkBlogTitle } from "@/lib/blog-rules";
import { parseId } from "@/lib/ids";
import { KEY_PATTERN } from "@/lib/attachments";
import { getMyBlog, requireMember } from "@/server/dal";
import { COVER_ERRORS, removeBlogCover, setBlogCover, updateBlogAccent as saveAccent, updateBlogInfo as saveInfo, updateBlogListStyle as saveListStyle, updateBlogSlug as saveSlug } from "@/server/blog";
import { isListStyle, LIST_STYLE_ERROR } from "@/lib/list-style";
import { ACCENT_ERROR, isBlogAccent } from "@/lib/blog-accent";
import * as category from "@/server/category";
import { addBlogStock as saveStock, removeBlogStock as dropStock } from "@/server/stocks";
import { checkStock, STOCK_ERRORS } from "@/lib/stocks";

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

export async function updateBlogAccent(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const member = await requireMember();
  const accent = text(formData, "accent");
  if (!isBlogAccent(accent)) return { error: ACCENT_ERROR };
  await saveAccent(member.userId, accent);
  refresh((await getMyBlog(member.userId)).slug);
  return { message: BLOG_ERRORS.saved, values: { accent } };
}

export async function updateBlogListStyle(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const member = await requireMember();
  const style = text(formData, "listStyle");
  if (!isListStyle(style)) return { error: LIST_STYLE_ERROR };
  await saveListStyle(member.userId, style);
  refresh((await getMyBlog(member.userId)).slug);
  return { message: BLOG_ERRORS.saved, values: { listStyle: style } };
}

export type CoverState = { error: string } | { message: string } | null;

/** 커버 사진 바꾸기: 화면이 `/api/uploads`로 올린 사진의 키를 받는다 */
export async function saveBlogCover(formData: FormData): Promise<CoverState> {
  const member = await requireMember();
  const key = formData.get("key");
  if (typeof key !== "string" || !KEY_PATTERN.test(key)) return { error: COVER_ERRORS.invalid };
  const error = await setBlogCover(member.userId, key);
  if (error) return { error };
  refresh((await getMyBlog(member.userId)).slug);
  return { message: COVER_ERRORS.saved };
}

/** 커버 사진 지우기 */
export async function deleteBlogCover(): Promise<CoverState> {
  const member = await requireMember();
  await removeBlogCover(member.userId);
  refresh((await getMyBlog(member.userId)).slug);
  return { message: COVER_ERRORS.removed };
}

export type StockState = { error: string } | { message: string } | null;

/** 📈 관심 종목 넣기: 검색 결과에서 고른 종목 (시장·코드·이름) */
export async function addBlogStock(formData: FormData): Promise<StockState> {
  const member = await requireMember();
  const item = checkStock(text(formData, "market"), text(formData, "code"), text(formData, "name"));
  if (!item) return { error: STOCK_ERRORS.invalid };
  const error = await saveStock(member.userId, item);
  if (error) return { error };
  refresh((await getMyBlog(member.userId)).slug);
  return { message: STOCK_ERRORS.added };
}

/** 📈 관심 종목 빼기 */
export async function removeBlogStock(formData: FormData): Promise<StockState> {
  const member = await requireMember();
  const id = parseId(text(formData, "id"));
  if (id === null) return { error: STOCK_ERRORS.invalid };
  await dropStock(member.userId, id);
  refresh((await getMyBlog(member.userId)).slug);
  return { message: STOCK_ERRORS.removed };
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
