import "server-only";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { blogs, follows, pointLedger, posts, profiles } from "@/db/schema";
import { levelFromExp } from "@/lib/game";
import { houseStage } from "@/lib/house";
import { NOTICE_SLUG } from "@/lib/names";
import { currentRoof, ROOF_HEX } from "@/lib/roof";
import { levelUpText, notificationText, notificationTime } from "@/lib/notifications";
import { getMyBlog, getNickname } from "./dal";
import { listMyNeighbors } from "./follows";
import { getAvatar } from "./items";
import { countUnreadNotifications, listNotifications } from "./notifications";
import { getWallet } from "./points";

/** 마을 길가의 집 하나 (TOWN-04). `lot`은 집 자리 번호(0은 내 집) */
export type TownHouse = {
  lot: number;
  slug: string;
  nickname: string;
  blogTitle: string;
  stage: number;
  roof: string;
  mine: boolean;
  /** 집 앞 우체통에 보일 최근 공개 글 3개 (TOWN-13), 최신순 */
  recentPosts: MailboxPost[];
};

export type MailboxPost = { id: number; title: string };

/** 우체통 새 글 수 */
export const MAILBOX_POSTS = 3;

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
  roofColor: blogs.roofColor,
  exp,
};

type HouseRow = {
  blogId: number;
  slug: string;
  nickname: string;
  blogTitle: string;
  roofColor: string | null;
  exp: number;
};

function toHouse(row: HouseRow, lot: number, mine: boolean): TownHouse & { blogId: number } {
  return {
    blogId: row.blogId,
    lot,
    slug: row.slug,
    nickname: row.nickname,
    blogTitle: row.blogTitle,
    stage: houseStage(levelFromExp(row.exp)),
    roof: ROOF_HEX[currentRoof(row.blogId, row.roofColor)],
    mine,
    recentPosts: [],
  };
}

/** 집마다 최근 공개 글 3개를 붙인다 (TOWN-13): 작성 시각 내림차순, 같으면 글 번호 내림차순 */
async function withRecentPosts(houses: (TownHouse & { blogId: number })[]): Promise<TownHouse[]> {
  if (houses.length === 0) return [];
  const ids = houses.map((h) => h.blogId);
  const rows = await db.execute<{ blog_id: number; id: number; title: string }>(sql`
    select blog_id, id, title from (
      select p.blog_id, p.id, p.title, row_number() over (partition by p.blog_id order by p.created_at desc, p.id desc) as n
      from ${posts} p where p.is_public and p.blog_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
    ) t where n <= ${MAILBOX_POSTS} order by blog_id, n`);
  return houses.map(({ blogId, ...house }) => ({
    ...house,
    recentPosts: rows.filter((r) => Number(r.blog_id) === blogId).map((r) => ({ id: Number(r.id), title: r.title })),
  }));
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
  return withRecentPosts([...mine.map((r) => toHouse(r, 0, true)), ...neighbors.map((r, i) => toHouse(r, i + 1, false))]);
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
  return withRecentPosts(rows.map((r, i) => toHouse(r, i + 1, false)));
}

export type HudNotification = { id: number; text: string; time: string; read: boolean };

/** ☰ 메뉴에 보일 회원 정보 (TOWN-12): 지갑·안 읽은 수·최근 알림 5개·이웃 목록. 페이지를 열 때 한 번 읽는다 */
export async function getHudMember(userId: string) {
  const now = new Date();
  const [wallet, unread, recent, neighbors, blog, avatar, nickname] = await Promise.all([
    getWallet(userId),
    countUnreadNotifications(userId),
    listNotifications(userId, 1),
    listMyNeighbors(userId),
    getMyBlog(userId),
    getAvatar(userId),
    getNickname(userId),
  ]);
  const notifications: HudNotification[] = recent.items.slice(0, HUD_NOTIFICATIONS).map((n) => ({
    id: n.id,
    text: n.kind === "level_up" ? levelUpText(n.level) : notificationText(n.kind, n.nickname, n.postTitle),
    time: notificationTime(n.createdAt, now),
    read: n.read,
  }));
  return {
    nickname,
    layers: avatar.layers,
    blog: { slug: blog.slug, title: blog.title },
    level: wallet.progress.level,
    coin: wallet.coin,
    exp: { current: wallet.progress.current, needed: wallet.progress.needed, ratio: wallet.progress.ratio, isMax: wallet.progress.isMax },
    unread,
    notifications,
    neighbors: neighbors.items.map((n) => ({ userId: n.userId, slug: n.slug, nickname: n.nickname, blogTitle: n.blogTitle, isFavorite: n.isFavorite, isNotice: n.isNotice })),
    neighborTotal: neighbors.total,
    favorites: neighbors.favorites,
  };
}

export type HudMember = Awaited<ReturnType<typeof getHudMember>>;

/** ☰ 🔔 알림 창의 최근 알림 수 */
export const HUD_NOTIFICATIONS = 5;
