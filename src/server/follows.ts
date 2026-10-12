import "server-only";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogs, follows, posts, profiles } from "@/db/schema";
import { NOTICE_SLUG } from "@/lib/names";
import { FAVORITE_MESSAGES, favoriteRefusal } from "@/lib/social";
import { assignLots, isNeighborLot, LOT_ERRORS, moveToLot } from "@/lib/town/lots";

/** 블로그 홈의 `이웃 N`: 이 블로그 주인을 이웃 추가한 사람 수 (SOC-04) */
export async function countFollowers(ownerId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(follows).where(eq(follows.followeeId, ownerId));
  return row.n;
}

/** 내가 이 회원을 이웃 추가했는지 */
export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const [row] = await db
    .select({ n: count() })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
  return row.n > 0;
}

/**
 * 이웃 추가·취소 (SOC-04). 내 이웃 행이 있으면 지우고(취소), 없으면 넣는다.
 * 넣을 때는 상대가 블로그를 가진 회원일 때만 1행이 생긴다 (#22). 겹친 요청은 기본 키가 막는다.
 * 자기 자신은 부르는 쪽에서 거르고, 그래도 오면 CHECK가 거부한다.
 */
export async function toggleFollow(followerId: string, followeeId: string): Promise<void> {
  const removed = await db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)))
    .returning({ followeeId: follows.followeeId });
  if (removed.length > 0) return;
  try {
    await db.execute(sql`
      insert into follows (follower_id, followee_id)
      select ${followerId}, b.owner_id from blogs b where b.owner_id = ${followeeId}
      on conflict do nothing`);
  } catch (e) {
    // 그 순간 상대가 탈퇴해 외래 키가 깨지면 조용히 끝낸다
    if ((e as { cause?: { code?: string }; code?: string }).cause?.code === "23503" || (e as { code?: string }).code === "23503") return;
    throw e;
  }
}

/** 내 이웃 목록은 이만큼만 보여 준다 (최근 공개 글 순) */
export const NEIGHBOR_LIST_LIMIT = 200;

export type Neighbor = {
  userId: string;
  slug: string;
  blogTitle: string;
  nickname: string;
  postCount: number;
  mutual: boolean;
  isFavorite: boolean;
  /** 공지사항 블로그 (⭐ 대신 📢, 켤 수 없다) */
  isNotice: boolean;
};

/**
 * 이웃 새 글 위 `내 이웃 N` (SOC-04 열린 질문의 제안): 내가 이웃 추가한 회원의 블로그.
 * 즐겨찾기(⭐, TOWN-08) 먼저, 그다음 최근 공개 글 순(공개 글이 없으면 뒤로, 그다음 닉네임 순).
 * 공개 글 수와 `서로 이웃`(상대도 나를 이웃 추가) 여부를 함께. `favorites`는 공지 블로그를 뺀 즐겨찾기 수.
 */
export async function listMyNeighbors(userId: string): Promise<{ items: Neighbor[]; total: number; favorites: number }> {
  const lastPublic = sql`(select max(p.created_at) from ${posts} p where p.blog_id = ${blogs.id} and p.is_public)`;
  const [items, [{ total }], favorites] = await Promise.all([
    db
      .select({
        userId: follows.followeeId,
        slug: blogs.slug,
        blogTitle: blogs.title,
        nickname: profiles.nickname,
        postCount: sql<number>`(select count(*) from ${posts} p where p.blog_id = ${blogs.id} and p.is_public)::int`,
        mutual: sql<boolean>`exists (select 1 from ${follows} back where back.follower_id = ${follows.followeeId} and back.followee_id = ${userId})`,
        isFavorite: follows.isFavorite,
        isNotice: sql<boolean>`${blogs.slug} = ${NOTICE_SLUG}`,
      })
      .from(follows)
      .innerJoin(blogs, eq(blogs.ownerId, follows.followeeId))
      .innerJoin(profiles, eq(profiles.userId, follows.followeeId))
      .where(eq(follows.followerId, userId))
      .orderBy(desc(follows.isFavorite), sql`${lastPublic} desc nulls last`, asc(profiles.nickname), asc(blogs.slug))
      .limit(NEIGHBOR_LIST_LIMIT),
    db.select({ total: count() }).from(follows).where(eq(follows.followerId, userId)),
    countFavorites(db, userId),
  ]);
  return { items, total, favorites };
}

type Runner = Pick<typeof db, "select">;

/** 공지사항 블로그를 뺀 내 즐겨찾기 수 (TOWN-08 `{n}/10`과 10명 제한) */
async function countFavorites(runner: Runner, userId: string): Promise<number> {
  const [row] = await runner
    .select({ n: count() })
    .from(follows)
    .innerJoin(blogs, eq(blogs.ownerId, follows.followeeId))
    .where(and(eq(follows.followerId, userId), eq(follows.isFavorite, true), sql`${blogs.slug} <> ${NOTICE_SLUG}`));
  return row.n;
}

/**
 * 즐겨찾는 이웃 ⭐ 켜기·끄기 (TOWN-08). 같은 회원의 요청은 잠금으로 줄 세워 동시에 눌러도 10명을 넘지 않는다.
 * 이웃 행이 없으면 거절한다. 켤 때만 공지 블로그와 10명 제한을 본다 (이미 켜 둔 ⭐는 언제나 끌 수 있다).
 * 끄면 골라 둔 집 자리(TOWN-18)도 비운다.
 * 거절하면 보여 줄 문구를, 바꾸면 null을 돌려준다.
 */
export async function toggleFavorite(followerId: string, followeeId: string): Promise<string | null> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"fav:" + followerId}))`);
    const [row] = await tx
      .select({ isFavorite: follows.isFavorite, slug: blogs.slug })
      .from(follows)
      .leftJoin(blogs, eq(blogs.ownerId, follows.followeeId))
      .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
    if (!row) return FAVORITE_MESSAGES.notNeighbor;
    const turningOn = !row.isFavorite;
    const refusal = favoriteRefusal({ turningOn, isNotice: row.slug === NOTICE_SLUG, count: turningOn ? await countFavorites(tx, followerId) : 0 });
    if (refusal) return refusal;
    await tx
      .update(follows)
      .set(turningOn ? { isFavorite: true } : { isFavorite: false, townLot: null })
      .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
    return null;
  });
}

/**
 * 이웃 집 자리 고르기 (TOWN-18): 내 ⭐ 즐겨찾기 이웃(공지 블로그 제외)을 `lot`번 자리로 옮긴다. 그 자리에 살던 이웃은
 * 옮긴 이웃의 옛 자리로 가고(맞바꾸기), 다른 이웃은 지금 자리에 그대로 선다(모두의 자리를 적어 둔다). ⭐ 켜기·끄기와 같은 회원별 잠금으로 줄 세운다. 거절하면 문구를, 바꾸면 null을 돌려준다.
 */
export async function setTownLot(followerId: string, followeeId: string, lot: unknown): Promise<string | null> {
  if (!isNeighborLot(lot)) return LOT_ERRORS.lot;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"fav:" + followerId}))`);
    const rows = await tx
      .select({ followeeId: follows.followeeId, townLot: follows.townLot })
      .from(follows)
      .innerJoin(blogs, eq(blogs.ownerId, follows.followeeId))
      .where(and(eq(follows.followerId, followerId), eq(follows.isFavorite, true), sql`${blogs.slug} <> ${NOTICE_SLUG}`))
      .orderBy(asc(follows.createdAt), asc(blogs.id));
    if (!rows.some((r) => r.followeeId === followeeId)) return LOT_ERRORS.notFavorite;
    const placed = assignLots(rows);
    const old = placed.find((p) => p.followeeId === followeeId)?.lot ?? null;
    if (old === lot) return null;
    // 다른 이웃은 지금 선 자리에 그대로 둔다(자리를 적어 둔다). 그 자리에 살던 이웃만 옛 자리로
    const final = moveToLot(placed.map((p) => ({ id: p.followeeId, lot: p.lot })), followeeId, lot);
    const changed = final.filter((f) => rows.find((r) => r.followeeId === f.id)?.townLot !== f.lot);
    const row = (id: string) => and(eq(follows.followerId, followerId), eq(follows.followeeId, id));
    // 자리 하나에 한 이웃(부분 유일 인덱스)이라 바뀌는 이웃의 자리를 먼저 모두 비운다
    for (const f of changed) await tx.update(follows).set({ townLot: null }).where(row(f.id));
    for (const f of changed) if (f.lot !== null) await tx.update(follows).set({ townLot: f.lot }).where(row(f.id));
    return null;
  });
}

/** 이웃 취소만 한다 (내 이웃 목록의 [✓ 이웃]). 겹쳐 눌러도 다시 추가되지 않는다 */
export async function unfollow(followerId: string, followeeId: string): Promise<void> {
  await db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
}
