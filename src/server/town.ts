import "server-only";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { blogs, follows, pointLedger, posts, profiles } from "@/db/schema";
import { levelFromExp } from "@/lib/game";
import { houseStage } from "@/lib/house";
import { todayKST } from "@/lib/kst";
import { NOTICE_SLUG } from "@/lib/names";
import { assignLots } from "@/lib/town/lots";
import { dailyLots, dailyPick, todayTasks } from "@/lib/town/plaza";
import { currentRoof, ROOF_HEX } from "@/lib/roof";
import { feedbackNotificationText, guestbookNotificationText, levelUpText, notificationText, notificationTime } from "@/lib/notifications";
import { getMyBlog, getNickname } from "./dal";
import { listMyNeighbors } from "./follows";
import { avatarLayersOf, getAvatar } from "./items";
import { countUnreadNotifications, listNotifications } from "./notifications";
import { getTodayState } from "./plaza";
import { getWallet } from "./points";
import { cached } from "./ttl-cache";

/** 마을 길가의 집 하나 (TOWN-04). `lot`은 집 자리 번호(0은 내 집) */
export type TownHouse = {
  lot: number;
  /** 집 주인 회원 (이웃 집 자리 고르기, TOWN-18) */
  userId: string;
  slug: string;
  nickname: string;
  blogTitle: string;
  stage: number;
  roof: string;
  mine: boolean;
  /** 집 앞 우체통에 보일 최근 공개 글 3개 (TOWN-13), 최신순 */
  recentPosts: MailboxPost[];
  /** 집 주인의 입은 모습 (걸어 다니는 이웃, TOWN-19) */
  layers: string[];
  /** 최근 24시간 안에 공개 글을 썼다: 광장에서 그 집 창에 불이 켜지고 굴뚝에 연기가 난다 (광장 개편) */
  fresh: boolean;
  /** 가장 최근 공개 글 제목 (`recentPosts[0]`, 걷는 이웃 말풍선·집 위 쪽지). 글이 없으면 없음 */
  latestTitle?: string;
  /** 추천 이웃의 흐린 집 (plaza-upgrade-2) */
  suggested?: boolean;
  /** 내가 아직 안 읽은 글이 있다 (plaza-upgrade-2). 없으면 `fresh`로 대신한다 */
  unread?: boolean;
  /** 오늘·어제 방문 수 (plaza-upgrade-2) */
  visitsToday?: number;
  visitsYesterday?: number;
};

/** `createdAt`은 ISO 문자열 (클라이언트 게임에 그대로 넘긴다) */
export type MailboxPost = { id: number; title: string; createdAt: string; read?: boolean };

/** 이 시간 안에 쓴 글이 있으면 불 켜진 집 */
export const FRESH_HOURS = 24;

/** 우체통 새 글 수 */
export const MAILBOX_POSTS = 3;

/** 즐겨찾는 이웃의 집은 10채까지 (TOWN-08과 같은 수) */
export const NEIGHBOR_HOUSES = 10;
/** 방문자 마을: 인기 블로그 이만큼에서 고른다 */
export const POPULAR_POOL = 100;
/** 방문자 마을 후보(인기 100곳)는 누구에게나 같아 1분 기억한다 */
const GUEST_POOL_TTL = 60_000;

const exp = sql<number>`(select coalesce(sum(l.exp_delta), 0) from ${pointLedger} l where l.user_id = ${blogs.ownerId})::int`;
const hasPublicPost = sql`exists (select 1 from posts p where p.blog_id = ${blogs.id} and p.is_public)`;

const houseColumns = {
  blogId: blogs.id,
  ownerId: blogs.ownerId,
  slug: blogs.slug,
  nickname: profiles.nickname,
  blogTitle: blogs.title,
  roofColor: blogs.roofColor,
  exp,
};

type HouseRow = {
  blogId: number;
  ownerId: string;
  slug: string;
  nickname: string;
  blogTitle: string;
  roofColor: string | null;
  exp: number;
};

export type TownHost = { userId: string; nickname: string; slug: string };

/** 친구 마을 구경 (TOWN-15): 블로그 주소의 주인. 없는 주소·공지 블로그면 null */
export async function getTownHost(slug: string): Promise<TownHost | null> {
  if (slug === NOTICE_SLUG) return null;
  const [row] = await db
    .select({ userId: blogs.ownerId, nickname: profiles.nickname, slug: blogs.slug })
    .from(blogs)
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .where(eq(blogs.slug, slug));
  return row ?? null;
}

function toHouse(row: HouseRow, lot: number, mine: boolean): TownHouse & { blogId: number } {
  return {
    blogId: row.blogId,
    lot,
    userId: row.ownerId,
    slug: row.slug,
    nickname: row.nickname,
    blogTitle: row.blogTitle,
    stage: houseStage(levelFromExp(row.exp)),
    roof: ROOF_HEX[currentRoof(row.blogId, row.roofColor)],
    mine,
    recentPosts: [],
    layers: [],
    fresh: false,
  };
}

/** 집마다 최근 공개 글 3개(TOWN-13: 작성 시각 내림차순, 같으면 글 번호 내림차순)와 주인의 입은 모습(TOWN-19)을 붙인다 */
async function withRecentPosts(houses: (TownHouse & { blogId: number })[]): Promise<TownHouse[]> {
  if (houses.length === 0) return [];
  const ids = houses.map((h) => h.blogId);
  const avatars = await avatarLayersOf(houses.map((h) => h.userId));
  const rows = await db.execute<{ blog_id: number; id: number; title: string; created_at: Date | string }>(sql`
    select blog_id, id, title, created_at from (
      select p.blog_id, p.id, p.title, p.created_at, row_number() over (partition by p.blog_id order by p.created_at desc, p.id desc) as n
      from ${posts} p where p.is_public and p.blog_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
    ) t where n <= ${MAILBOX_POSTS} order by blog_id, n`);
  const since = Date.now() - FRESH_HOURS * 3_600_000;
  return houses.map(({ blogId, ...house }) => {
    const recentPosts = rows
      .filter((r) => Number(r.blog_id) === blogId)
      .map((r) => ({ id: Number(r.id), title: r.title, createdAt: new Date(r.created_at).toISOString() }));
    return {
      ...house,
      recentPosts,
      layers: avatars.get(house.userId) ?? [],
      fresh: recentPosts.length > 0 && Date.parse(recentPosts[0].createdAt) >= since,
      latestTitle: recentPosts[0]?.title,
    };
  });
}

function houseQuery(where: SQL | undefined) {
  return db.select(houseColumns).from(blogs).innerJoin(profiles, eq(profiles.userId, blogs.ownerId)).where(where);
}

/**
 * 회원의 마을 (TOWN-04): 0번은 그 회원의 집(공지 블로그 주인에게도 내 집), 1번부터 그 회원이 즐겨찾는 이웃의 집.
 * 먼저 이웃이 된 순서로 10채까지, 공지 블로그는 빼고 공개 글이 없어도 선다. 자리는 그 회원이 고른 자리(TOWN-18)가 먼저,
 * 안 고른 이웃은 남은 자리를 작은 번호부터 (`assignLots`).
 * 친구 마을 구경(TOWN-15)이면 `viewerId`가 보는 사람: 그 사람의 집만 `mine`(내 집·내 우체통)이다.
 */
export async function getMemberHouses(userId: string, viewerId = userId): Promise<TownHouse[]> {
  const [mine, neighbors] = await Promise.all([
    houseQuery(eq(blogs.ownerId, userId)),
    db
      .select({ ...houseColumns, townLot: follows.townLot })
      .from(follows)
      .innerJoin(blogs, eq(blogs.ownerId, follows.followeeId))
      .innerJoin(profiles, eq(profiles.userId, follows.followeeId))
      .where(and(eq(follows.followerId, userId), eq(follows.isFavorite, true), sql`${blogs.slug} <> ${NOTICE_SLUG}`))
      .orderBy(asc(follows.createdAt), asc(blogs.id))
      .limit(NEIGHBOR_HOUSES),
  ]);
  const placed = assignLots(neighbors).sort((a, b) => a.lot - b.lot);
  return withRecentPosts([...mine.map((r) => toHouse(r, 0, r.ownerId === viewerId)), ...placed.map((r) => toHouse(r, r.lot, r.ownerId === viewerId))]);
}

/**
 * 방문자의 마을 (TOWN-04): 공개 글이 있고 공지 블로그가 아닌 블로그를 누적 방문자 수 → 최근 공개 글 순으로
 * 100곳 고른 뒤(1분 기억), 그 안에서 10곳. 한국 날짜와 블로그 번호로 매긴 순위로 골라(`dailyPick`) 자리도 같은 열쇠로 정해(`dailyLots`)
 * 하루 동안 같은 마을이 선다: 방문 수가 늘어 100곳의 순서가 바뀌어도 그대로고, 100곳에 하나가 들고 나도 그 집 말고 자리를 옮기는 집은 대개 한두 채다.
 * 우체통 글·불 켜진 집은 기억하지 않고 매번 읽는다. 0번(내 집 자리)은 비어 있다.
 */
export async function getGuestHouses(now = new Date()): Promise<TownHouse[]> {
  const pool = await cached("guest-town-pool", GUEST_POOL_TTL, loadGuestPool);
  const day = todayKST(now);
  const rows = dailyPick(pool, day, (r) => r.blogId, NEIGHBOR_HOUSES);
  const placed = dailyLots(rows, day, (r) => r.blogId, NEIGHBOR_HOUSES).sort((a, b) => a.lot - b.lot);
  return withRecentPosts(placed.map(({ item, lot }) => toHouse(item, lot, false)));
}

function loadGuestPool(): Promise<HouseRow[]> {
  return houseQuery(and(hasPublicPost, sql`${blogs.slug} <> ${NOTICE_SLUG}`))
    .orderBy(
      desc(sql`(select count(*) from blog_visits v where v.blog_id = ${blogs.id})`),
      desc(sql`(select max(p.created_at) from posts p where p.blog_id = ${blogs.id} and p.is_public)`),
      desc(blogs.id),
    )
    .limit(POPULAR_POOL)
    .then((rows) => rows);
}

export type HudNotification = { id: number; text: string; time: string; read: boolean };

/**
 * ☰ 메뉴와 광장 HUD에 보일 회원 정보 (TOWN-12, 광장 개편): 지갑·안 읽은 수·최근 알림 5개·이웃 목록,
 * 그리고 오늘 할 일(글쓰기 보상 n/3·출석·낚시·동물 돌보기). 페이지를 열 때 한 번 읽는다
 */
export async function getHudMember(userId: string) {
  const now = new Date();
  const [wallet, unread, recent, neighbors, blog, avatar, nickname, today] = await Promise.all([
    getWallet(userId),
    countUnreadNotifications(userId),
    listNotifications(userId, 1),
    listMyNeighbors(userId),
    getMyBlog(userId),
    getAvatar(userId),
    getNickname(userId),
    getTodayState(userId),
  ]);
  const notifications: HudNotification[] = recent.items.slice(0, HUD_NOTIFICATIONS).map((n) => ({
    id: n.id,
    text:
      n.kind === "level_up"
        ? levelUpText(n.level)
        : n.kind === "feedback_reply"
          ? feedbackNotificationText(n.feedbackTitle)
          : n.kind === "guestbook" || n.kind === "guestbook_reply"
            ? guestbookNotificationText(n.kind, n.nickname)
            : notificationText(n.kind, n.nickname, n.postTitle),
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
    /** 오늘 받은 글쓰기 보상 수 (상한 REWARD_RULES.post 3번): ✏️ 글쓰기 버튼의 칸 */
    postRewardsToday: today.postRewards,
    /** 오늘 공개 글을 1편 이상 썼다 (보상과 따로: 짧은 글도 친다) */
    postedToday: today.postedToday,
    /** 광장 소식 서랍 [오늘 할 일] */
    tasks: todayTasks(today),
  };
}

export type HudMember = Awaited<ReturnType<typeof getHudMember>>;

/** ☰ 🔔 알림 창의 최근 알림 수 */
export const HUD_NOTIFICATIONS = 5;
