import "server-only";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { blogs, blogVisits, follows, pointLedger, posts, profiles } from "@/db/schema";
import { levelFromExp } from "@/lib/game";
import { houseStage } from "@/lib/house";
import { previousDay, todayKST } from "@/lib/kst";
import { NOTICE_SLUG } from "@/lib/names";
import { assignLots, pickSuggestions, suggestionLots } from "@/lib/town/lots";
import { dailyLots, dailyPick, todayTasks } from "@/lib/town/plaza";
import { currentRoof, ROOF_HEX } from "@/lib/roof";
import { feedbackNotificationText, guestbookNotificationText, levelUpText, notificationText, notificationTime } from "@/lib/notifications";
import { getMyBlog, getNickname } from "./dal";
import { listMyNeighbors } from "./follows";
import { avatarLayersOf, getAvatar } from "./items";
import { countUnreadNotifications, listNotifications } from "./notifications";
import { getTodayState } from "./plaza";
import { getWallet } from "./points";
import { viewedRecently } from "./stats";
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

/**
 * 집마다 최근 공개 글 3개(TOWN-13: 작성 시각 내림차순, 같으면 글 번호 내림차순)와 주인의 입은 모습(TOWN-19)을 붙인다.
 * plaza-upgrade-2: 글마다 이 브라우저가 읽었는지(`read`, 방문자 쿠키 `visitorId`, 글 쿼리의 한 칸이라 왕복이 늘지 않는다),
 * 집마다 안 읽은 24시간 새 글이 있는지(`unread`), 오늘·어제 방문 수(blog_visits 기본 키, 한 번의 group by)를 붙인다.
 * 세 쿼리(입은 모습·글·방문 수)는 함께 돈다.
 */
async function withRecentPosts(houses: (TownHouse & { blogId: number })[], visitorId: string | null = null): Promise<TownHouse[]> {
  if (houses.length === 0) return [];
  const ids = houses.map((h) => h.blogId);
  const idList = sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  );
  const today = todayKST();
  const yesterday = previousDay(today);
  const [avatars, rows, visits] = await Promise.all([
    avatarLayersOf(houses.map((h) => h.userId)),
    db.execute<{ blog_id: number; id: number; title: string; created_at: Date | string; read: boolean }>(sql`
    select blog_id, id, title, created_at, read from (
      select p.blog_id, p.id, p.title, p.created_at, ${viewedRecently(sql`p.id`, visitorId)} as read,
        row_number() over (partition by p.blog_id order by p.created_at desc, p.id desc) as n
      from ${posts} p where p.is_public and p.blog_id in (${idList})
    ) t where n <= ${MAILBOX_POSTS} order by blog_id, n`),
    db
      .select({
        blogId: blogVisits.blogId,
        today: sql<number>`count(*) filter (where ${blogVisits.date} = ${today})::int`,
        yesterday: sql<number>`count(*) filter (where ${blogVisits.date} = ${yesterday})::int`,
      })
      .from(blogVisits)
      .where(and(sql`${blogVisits.blogId} in (${idList})`, sql`${blogVisits.date} >= ${yesterday}`))
      .groupBy(blogVisits.blogId),
  ]);
  const since = Date.now() - FRESH_HOURS * 3_600_000;
  return houses.map(({ blogId, ...house }) => {
    const recentPosts = rows
      .filter((r) => Number(r.blog_id) === blogId)
      .map((r) => ({ id: Number(r.id), title: r.title, createdAt: new Date(r.created_at).toISOString(), ...(r.read ? { read: true } : {}) }));
    const fresh = recentPosts.length > 0 && Date.parse(recentPosts[0].createdAt) >= since;
    const visit = visits.find((v) => v.blogId === blogId);
    return {
      ...house,
      recentPosts,
      layers: avatars.get(house.userId) ?? [],
      fresh,
      unread: fresh && recentPosts.some((p) => Date.parse(p.createdAt) >= since && !p.read),
      latestTitle: recentPosts[0]?.title,
      visitsToday: Number(visit?.today ?? 0),
      visitsYesterday: Number(visit?.yesterday ?? 0),
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
 * 내 마을이고 즐겨찾기가 10명보다 적으면 빈 자리(뒤쪽부터, 4번 빼고) 3곳까지 이사 올 이웃(`suggested`)의 흐린 집을 세운다 (plaza-upgrade-2).
 * `visitorId`(방문자 쿠키)는 읽은 새 글 표시에 쓴다.
 */
export async function getMemberHouses(userId: string, viewerId = userId, visitorId: string | null = null): Promise<TownHouse[]> {
  const own = userId === viewerId;
  const [mine, neighbors, close] = await Promise.all([
    houseQuery(eq(blogs.ownerId, userId)),
    db
      .select({ ...houseColumns, townLot: follows.townLot })
      .from(follows)
      .innerJoin(blogs, eq(blogs.ownerId, follows.followeeId))
      .innerJoin(profiles, eq(profiles.userId, follows.followeeId))
      .where(and(eq(follows.followerId, userId), eq(follows.isFavorite, true), sql`${blogs.slug} <> ${NOTICE_SLUG}`))
      .orderBy(asc(follows.createdAt), asc(blogs.id))
      .limit(NEIGHBOR_HOUSES),
    own ? loadCloseCandidates(userId) : Promise.resolve([]),
  ]);
  const placed = assignLots(neighbors).sort((a, b) => a.lot - b.lot);
  const suggested = own && placed.length < NEIGHBOR_HOUSES ? await suggestHouses(userId, placed, close) : [];
  const all = [...placed.map((r) => toHouse(r, r.lot, r.ownerId === viewerId)), ...suggested].sort((a, b) => a.lot - b.lot);
  return withRecentPosts([...mine.map((r) => toHouse(r, 0, r.ownerId === viewerId)), ...all], visitorId);
}

/**
 * 이사 올 이웃 후보 중 가까운 사람 (plaza-upgrade-2): 나를 ⭐한 회원(tier 1, follows_followee_idx), 내가 이웃만 맺은 회원(tier 2).
 * 나·공지 블로그·이미 ⭐한 이웃은 뺀다. 묶음마다 50명까지.
 */
function loadCloseCandidates(userId: string): Promise<(HouseRow & { tier: number })[]> {
  const favoredMe = sql`exists (select 1 from ${follows} f where f.followee_id = ${userId} and f.follower_id = ${blogs.ownerId} and f.is_favorite)`;
  const iFollow = sql`exists (select 1 from ${follows} f where f.follower_id = ${userId} and f.followee_id = ${blogs.ownerId})`;
  const iFavorite = sql`exists (select 1 from ${follows} f where f.follower_id = ${userId} and f.followee_id = ${blogs.ownerId} and f.is_favorite)`;
  return db
    .select({ ...houseColumns, tier: sql<number>`(case when ${favoredMe} then 1 else 2 end)::int` })
    .from(blogs)
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .where(and(sql`${blogs.ownerId} <> ${userId}`, sql`${blogs.slug} <> ${NOTICE_SLUG}`, sql`not ${iFavorite}`, sql`(${favoredMe} or ${iFollow})`))
    .orderBy(asc(blogs.id))
    .limit(100)
    .then((rows) => rows);
}

/**
 * 빈 자리에 세울 이사 올 이웃 (plaza-upgrade-2, `suggestionLots`·`pickSuggestions`): 가까운 후보가 모자라면 방문자 마을의 활동 블로그(1분 기억)에서.
 * 한국 날짜와 내 회원 번호를 씨앗으로 골라(`dailyPick`) 하루 동안 같은 후보다.
 */
async function suggestHouses(userId: string, placed: readonly { ownerId: string; lot: number }[], close: readonly (HouseRow & { tier: number })[]) {
  const lots = suggestionLots(placed.map((p) => p.lot));
  if (lots.length === 0) return [];
  const seed = `${todayKST()}:${userId}`;
  const pick = (items: readonly HouseRow[]) => dailyPick(items, seed, (r) => r.blogId, items.length);
  const skip = new Set([userId, ...placed.map((p) => p.ownerId)]);
  const tiers: HouseRow[][] = [close.filter((c) => c.tier === 1), close.filter((c) => c.tier === 2)];
  let chosen = pickSuggestions(tiers, (r) => r.ownerId, skip, lots.length, pick);
  if (chosen.length < lots.length) {
    const settled = await loadSettledCandidates(seed, userId);
    chosen = pickSuggestions([...tiers, settled], (r) => r.ownerId, skip, lots.length, pick);
  }
  if (chosen.length < lots.length) {
    // 어제까지의 블로그가 모자라면(새로 연 사이트) 방문자 마을의 활동 블로그(1분 기억)에서
    const pool = await cached("guest-town-pool", GUEST_POOL_TTL, loadGuestPool);
    chosen = pickSuggestions([...tiers, chosen, pool], (r) => r.ownerId, skip, lots.length, pick);
  }
  return chosen.map((row, i) => ({ ...toHouse(row, lots[i], false), suggested: true }));
}

/**
 * 방문자의 마을 (TOWN-04): 공개 글이 있고 공지 블로그가 아닌 블로그를 누적 방문자 수 → 최근 공개 글 순으로
 * 100곳 고른 뒤(1분 기억), 그 안에서 10곳. 한국 날짜와 블로그 번호로 매긴 순위로 골라(`dailyPick`) 자리도 같은 열쇠로 정해(`dailyLots`)
 * 하루 동안 같은 마을이 선다: 방문 수가 늘어 100곳의 순서가 바뀌어도 그대로고, 100곳에 하나가 들고 나도 그 집 말고 자리를 옮기는 집은 대개 한두 채다.
 * 우체통 글·불 켜진 집은 기억하지 않고 매번 읽는다. 0번(내 집 자리)은 비어 있다.
 */
export async function getGuestHouses(now = new Date(), visitorId: string | null = null): Promise<TownHouse[]> {
  const pool = await cached("guest-town-pool", GUEST_POOL_TTL, loadGuestPool);
  const day = todayKST(now);
  const rows = dailyPick(pool, day, (r) => r.blogId, NEIGHBOR_HOUSES);
  const placed = dailyLots(rows, day, (r) => r.blogId, NEIGHBOR_HOUSES).sort((a, b) => a.lot - b.lot);
  return withRecentPosts(
    placed.map(({ item, lot }) => toHouse(item, lot, false)),
    visitorId,
  );
}

/**
 * 이사 올 이웃의 활동 블로그 후보 (tier 3): 어제까지 만들어졌고 어제까지 쓴 공개 글이 있는 블로그(공지·나 제외) 중
 * 하루 씨앗(`md5(씨앗 || 블로그 번호)`) 순으로 30곳. 오늘 생긴 블로그·오늘 쓴 글·방문 수와 상관없어서 하루 동안 같은 후보가 선다
 * (방문 수 순 인기 100곳은 하루에도 들고 나서 후보가 바뀌었다).
 */
function loadSettledCandidates(seed: string, userId: string): Promise<HouseRow[]> {
  const today = sql`(date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')`;
  return houseQuery(
    and(
      sql`${blogs.slug} <> ${NOTICE_SLUG}`,
      sql`${blogs.ownerId} <> ${userId}`,
      sql`${blogs.createdAt} < ${today}`,
      sql`exists (select 1 from posts p where p.blog_id = ${blogs.id} and p.is_public and p.created_at < ${today})`,
    ),
  )
    .orderBy(sql`md5(${seed} || ${blogs.id}::text)`)
    .limit(30)
    .then((rows) => rows);
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

export type HudNotification = {
  id: number;
  text: string;
  time: string;
  read: boolean;
  /** 방명록(우체통 쪽지) 알림이면 true: 내 우체통에서 ✉️로 보인다 (plaza-upgrade-2) */
  note?: boolean;
};

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
    ...(n.kind === "guestbook" ? { note: true } : {}),
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
    /** 광장 소식 서랍 [오늘 할 일] (💬 댓글 칸이 갈 글은 페이지가 서랍 소식을 읽은 뒤 `commentTarget`으로 바꾼다) */
    tasks: todayTasks(today),
  };
}

export type HudMember = Awaited<ReturnType<typeof getHudMember>>;

/** ☰ 🔔 알림 창의 최근 알림 수 */
export const HUD_NOTIFICATIONS = 5;
