import "server-only";
import { and, asc, count, eq, gt, lt, max, desc, inArray } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { categories, posts, subcategories } from "@/db/schema";
import { CATEGORY_ERRORS, checkCategoryName } from "@/lib/category-rules";
import { isUniqueViolation } from "./names";
import { lockBlog } from "./blog";

export type Kind = "category" | "sub";

export type CategoryTree = {
  id: number;
  name: string;
  postCount: number;
  subs: { id: number; name: string; postCount: number }[];
}[];

/** 블로그의 대분류·소분류 순서대로, 보는 사람이 볼 수 있는 글 수와 함께 (BLOG-05, POST-05) */
export async function getCategoryTree(blogId: number, viewerIsOwner: boolean): Promise<CategoryTree> {
  const cats = await db.select().from(categories).where(eq(categories.blogId, blogId)).orderBy(asc(categories.position));
  if (cats.length === 0) return [];
  const subs = await db
    .select()
    .from(subcategories)
    .where(inArray(subcategories.categoryId, cats.map((c) => c.id)))
    .orderBy(asc(subcategories.position));

  const visible = and(eq(posts.blogId, blogId), viewerIsOwner ? undefined : eq(posts.isPublic, true));
  const catCounts = await db
    .select({ id: posts.categoryId, n: count() })
    .from(posts)
    .where(visible)
    .groupBy(posts.categoryId);
  const subCounts = await db
    .select({ id: posts.subcategoryId, n: count() })
    .from(posts)
    .where(visible)
    .groupBy(posts.subcategoryId);
  const catN = new Map(catCounts.map((r) => [r.id, r.n]));
  const subN = new Map(subCounts.map((r) => [r.id, r.n]));

  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    postCount: catN.get(c.id) ?? 0,
    subs: subs.filter((s) => s.categoryId === c.id).map((s) => ({ id: s.id, name: s.name, postCount: subN.get(s.id) ?? 0 })),
  }));
}

/** 글쓰기 화면의 선택지 */
export async function getCategoryOptions(blogId: number) {
  const tree = await getCategoryTree(blogId, true);
  return tree.map(({ id, name, subs }) => ({ id, name, subs: subs.map(({ id, name }) => ({ id, name })) }));
}

/** 대상 행이 이 블로그 것인지 확인하고 부모 ID(소분류면 대분류 ID)를 돌려준다 */
async function ownedParent(tx: Tx, blogId: number, kind: Kind, id: number): Promise<number | null> {
  if (kind === "category") {
    const [row] = await tx.select({ id: categories.id }).from(categories).where(and(eq(categories.id, id), eq(categories.blogId, blogId)));
    return row ? blogId : null;
  }
  const [row] = await tx
    .select({ parent: subcategories.categoryId })
    .from(subcategories)
    .innerJoin(categories, eq(categories.id, subcategories.categoryId))
    .where(and(eq(subcategories.id, id), eq(categories.blogId, blogId)));
  return row?.parent ?? null;
}

function withNameErrors<T>(run: () => Promise<T>): Promise<T | string> {
  return run().catch((e) => {
    if (isUniqueViolation(e)) return CATEGORY_ERRORS.taken;
    throw e;
  });
}

export async function addCategory(blogId: number, rawName: string): Promise<string | null> {
  const error = checkCategoryName(rawName);
  if (error) return error;
  const name = rawName.trim();
  const result = await withNameErrors(() =>
    db.transaction(async (tx) => {
      await lockBlog(tx, blogId);
      const [{ top }] = await tx.select({ top: max(categories.position) }).from(categories).where(eq(categories.blogId, blogId));
      await tx.insert(categories).values({ blogId, name, position: (top ?? 0) + 1 });
      return null;
    }),
  );
  return result;
}

export async function addSubcategory(blogId: number, categoryId: number, rawName: string): Promise<string | null> {
  const error = checkCategoryName(rawName);
  if (error) return error;
  const name = rawName.trim();
  return withNameErrors(() =>
    db.transaction(async (tx) => {
      await lockBlog(tx, blogId);
      if ((await ownedParent(tx, blogId, "category", categoryId)) === null) return null; // 남의 것: 아무것도 안 함
      const [{ top }] = await tx
        .select({ top: max(subcategories.position) })
        .from(subcategories)
        .where(eq(subcategories.categoryId, categoryId));
      await tx.insert(subcategories).values({ categoryId, name, position: (top ?? 0) + 1 });
      return null;
    }),
  );
}

export async function renameCategory(blogId: number, kind: Kind, id: number, rawName: string): Promise<string | null> {
  const error = checkCategoryName(rawName);
  if (error) return error;
  const name = rawName.trim();
  return withNameErrors(() =>
    db.transaction(async (tx) => {
      await lockBlog(tx, blogId);
      if ((await ownedParent(tx, blogId, kind, id)) === null) return CATEGORY_ERRORS.invalid;
      if (kind === "category") await tx.update(categories).set({ name }).where(eq(categories.id, id));
      else await tx.update(subcategories).set({ name }).where(eq(subcategories.id, id));
      return null;
    }),
  );
}

/** ▲(-1)·▼(1): 같은 부모 안의 바로 위·아래와 순서를 맞바꾼다. 끝이면 그대로. */
export async function moveCategory(blogId: number, kind: Kind, id: number, direction: -1 | 1) {
  await db.transaction(async (tx) => {
    await lockBlog(tx, blogId);
    const parent = await ownedParent(tx, blogId, kind, id);
    if (parent === null) return;
    const table = kind === "category" ? categories : subcategories;
    const parentCol = kind === "category" ? categories.blogId : subcategories.categoryId;
    const [me] = await tx.select({ position: table.position }).from(table).where(eq(table.id, id));
    const [neighbor] = await tx
      .select({ id: table.id, position: table.position })
      .from(table)
      .where(and(eq(parentCol, parent), direction < 0 ? lt(table.position, me.position) : gt(table.position, me.position)))
      .orderBy(direction < 0 ? desc(table.position) : asc(table.position))
      .limit(1);
    if (!neighbor) return;
    await tx.update(table).set({ position: neighbor.position }).where(eq(table.id, id));
    await tx.update(table).set({ position: me.position }).where(eq(table.id, neighbor.id));
  });
}

/**
 * 소분류를 지우면 그 글은 대분류에 남고, 대분류를 지우면 소분류도 지워지고 글은 "카테고리 없음"이 된다.
 * (posts의 CHECK가 "소분류만 있는 글"을 막으므로 글을 먼저 정리한다)
 */
export async function deleteCategory(blogId: number, kind: Kind, id: number) {
  await db.transaction(async (tx) => {
    await lockBlog(tx, blogId);
    if ((await ownedParent(tx, blogId, kind, id)) === null) return;
    if (kind === "sub") {
      await tx.update(posts).set({ subcategoryId: null }).where(eq(posts.subcategoryId, id));
      await tx.delete(subcategories).where(eq(subcategories.id, id));
    } else {
      await tx.update(posts).set({ categoryId: null, subcategoryId: null }).where(eq(posts.categoryId, id));
      await tx.delete(categories).where(eq(categories.id, id));
    }
  });
}

/**
 * 글에 붙일 카테고리 (POST-03). 대분류가 내 것이 아니거나 지워졌으면 둘 다 비우고(오류 아님),
 * 소분류가 지워졌으면 대분류만. 소분류가 다른 대분류 소속이면 오류.
 */
export async function resolveCategory(
  tx: Tx,
  blogId: number,
  categoryId: number | null,
  subcategoryId: number | null,
): Promise<{ categoryId: number | null; subcategoryId: number | null } | "invalid"> {
  if (categoryId === null) return { categoryId: null, subcategoryId: null };
  const [cat] = await tx.select({ id: categories.id }).from(categories).where(and(eq(categories.id, categoryId), eq(categories.blogId, blogId)));
  if (!cat) return { categoryId: null, subcategoryId: null };
  if (subcategoryId === null) return { categoryId, subcategoryId: null };
  const [sub] = await tx.select({ parent: subcategories.categoryId }).from(subcategories).where(eq(subcategories.id, subcategoryId));
  if (!sub) return { categoryId, subcategoryId: null };
  if (sub.parent !== categoryId) return "invalid";
  return { categoryId, subcategoryId };
}

