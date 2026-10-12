import "server-only";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { blogs, follows, pointLedger, profiles } from "@/db/schema";
import { roofColor } from "@/lib/art/town";
import { levelFromExp } from "@/lib/game";
import { houseStage } from "@/lib/house";
import { NOTICE_SLUG } from "@/lib/names";

/** 마을 길가의 집 하나 (TOWN-04). `lot`은 집 자리 번호(0은 내 집) */
export type TownHouse = {
  lot: number;
  slug: string;
  nickname: string;
  blogTitle: string;
  stage: number;
  roof: string;
  mine: boolean;
};

/** 즐겨찾는 이웃의 집은 10채까지 (TOWN-08과 같은 수) */
export const NEIGHBOR_HOUSES = 10;
/** 방문자 마을: 인기 블로그 이만큼에서 무작위로 고른다 */
export const POPULAR_POOL = 100;

const exp = sql<number>`(select coalesce(sum(l.exp_delta), 0) from ${pointLedger} l where l.user_id = ${blogs.ownerId})::int`;
const hasPublicPost = sql`exists (select 1 from posts p where p.blog_id = ${blogs.id} and p.is_public)`;

const houseColumns = {
  blogId: blogs.id,
  slug: blogs.slug,
  nickname: profiles.nickname,
  blogTitle: blogs.title,
  exp,
};

type HouseRow = {
  blogId: number;
  slug: string;
  nickname: string;
  blogTitle: string;
  exp: number;
};

function toHouse(row: HouseRow, lot: number, mine: boolean): TownHouse {
  return {
    lot,
    slug: row.slug,
    nickname: row.nickname,
    blogTitle: row.blogTitle,
    stage: houseStage(levelFromExp(row.exp)),
    roof: roofColor(row.blogId),
    mine,
  };
}

function houseQuery(where: SQL | undefined) {
  return db.select(houseColumns).from(blogs).innerJoin(profiles, eq(profiles.userId, blogs.ownerId)).where(where);
}

/**
 * 회원의 마을 (TOWN-04): 0번은 내 집(공지 블로그 주인에게도 내 집), 1번부터 즐겨찾는 이웃의 집.
 * 먼저 이웃이 된 순서로 10채까지, 공지 블로그는 빼고 공개 글이 없어도 선다.
 */
export async function getMemberHouses(userId: string): Promise<TownHouse[]> {
  const [mine, neighbors] = await Promise.all([
    houseQuery(eq(blogs.ownerId, userId)),
    db
      .select(houseColumns)
      .from(follows)
      .innerJoin(blogs, eq(blogs.ownerId, follows.followeeId))
      .innerJoin(profiles, eq(profiles.userId, follows.followeeId))
      .where(and(eq(follows.followerId, userId), eq(follows.isFavorite, true), sql`${blogs.slug} <> ${NOTICE_SLUG}`))
      .orderBy(asc(follows.createdAt), asc(blogs.id))
      .limit(NEIGHBOR_HOUSES),
  ]);
  return [...mine.map((r) => toHouse(r, 0, true)), ...neighbors.map((r, i) => toHouse(r, i + 1, false))];
}

/**
 * 방문자의 마을 (TOWN-04): 공개 글이 있고 공지 블로그가 아닌 블로그를 누적 방문자 수 → 최근 공개 글 순으로
 * 100곳 고른 뒤, 그 안에서 열 때마다 무작위 10곳. 0번(내 집 자리)은 비어 있다.
 */
export async function getGuestHouses(): Promise<TownHouse[]> {
  const popular = db
    .select({ blogId: blogs.id })
    .from(blogs)
    .where(and(hasPublicPost, sql`${blogs.slug} <> ${NOTICE_SLUG}`))
    .orderBy(
      desc(sql`(select count(*) from blog_visits v where v.blog_id = ${blogs.id})`),
      desc(sql`(select max(p.created_at) from posts p where p.blog_id = ${blogs.id} and p.is_public)`),
      desc(blogs.id),
    )
    .limit(POPULAR_POOL)
    .as("popular");
  const rows = await db
    .select(houseColumns)
    .from(popular)
    .innerJoin(blogs, eq(blogs.id, popular.blogId))
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .orderBy(sql`random()`)
    .limit(NEIGHBOR_HOUSES);
  return rows.map((r, i) => toHouse(r, i + 1, false));
}
