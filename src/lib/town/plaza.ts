// 광장 HUD의 순수 함수 (광장 개편): 이웃 새 글 고르기, 오늘 할 일, 게시판 쪽지 수, 방문자 마을 고르기, 장소 간판 시계.
// 서버(server/plaza.ts·town.ts)와 화면(TownHud·PhonePlaza)이 같이 쓴다. 단위 시험 tests/unit/plaza.test.ts.

import { REWARD_RULES } from "@/lib/game";
import { todayKST } from "@/lib/kst";
import { favoriteWindowStart } from "@/lib/social";
import { SKY_LABELS, skyAt, type Sky } from "./sky";
import type { ReturnSpot } from "./zones";

/** 광장 소식 서랍·휴대폰 광장의 글 한 편. `createdAt`은 ISO 문자열 (화면에 그대로 넘긴다), `fresh`는 24시간 안에 쓴 글 */
export type PlazaPost = { id: number; title: string; slug: string; nickname: string; createdAt: string; fresh?: boolean };

/**
 * 광장 소식: 즐겨찾는 이웃(마을에 집이 선 이웃)의 7일 안 공개 글(`neighbors`), 그런 글이 없으면 마을 전체 새 글(`village`).
 * `todayCount`는 그중 오늘(한국 날짜) 쓴 글 수.
 */
export type PlazaNews = { scope: "neighbors" | "village"; posts: PlazaPost[]; todayCount: number };

/** 서랍에 보일 글 수 */
export const PLAZA_NEWS_SIZE = 8;
/** 게시판 그림의 오늘 새 글 쪽지는 5장까지 */
export const BOARD_PAPERS_MAX = 5;
/** 이 시간 안에 쓴 글은 서랍에서 불 켜진 창 표시 (광장의 불 켜진 집과 같은 24시간) */
export const FRESH_POST_HOURS = 24;

type HousePosts = {
  lot: number;
  mine: boolean;
  slug: string;
  nickname: string;
  recentPosts: readonly { id: number; title: string; createdAt: string }[];
};

/** 최신순 (작성 시각 내림차순, 같으면 글 번호 내림차순: 우체통·마을 소식과 같은 순서) */
function newestFirst(a: PlazaPost, b: PlazaPost): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id;
}

/**
 * 마을 집들의 우체통 글(집마다 최근 3편)에서 이웃 새 글을 고른다: 내 집(`mine`)·0번 자리는 빼고, 7일 안의 글만, 최신순 8편.
 * 7일은 마을 소식이 즐겨찾는 이웃의 글을 맨 위로 올리는 기간과 같다 (한국 날짜로 오늘 포함 7일, `favoriteWindowStart`).
 * 쿼리를 더 하지 않으려고 집에 이미 실려 온 글을 쓴다 (한 이웃이 7일에 4편 넘게 써도 3편까지만 보인다).
 */
export function neighborNews(houses: readonly HousePosts[], now = new Date()): PlazaPost[] {
  const since = favoriteWindowStart(now).getTime();
  return houses
    .filter((h) => h.lot > 0 && !h.mine)
    .flatMap((h) =>
      h.recentPosts
        .filter((p) => Date.parse(p.createdAt) >= since)
        .map((p) => ({ id: p.id, title: p.title, slug: h.slug, nickname: h.nickname, createdAt: p.createdAt })),
    )
    .sort(newestFirst)
    .slice(0, PLAZA_NEWS_SIZE);
}

/** 오늘(한국 날짜) 쓴 글 수 */
export function countToday(posts: readonly { createdAt: string }[], now = new Date()): number {
  const today = todayKST(now);
  return posts.filter((p) => todayKST(new Date(p.createdAt)) === today).length;
}

/** 서랍 소식: 이웃 글이 있으면 그것, 없으면 마을 전체 글 (방문자는 늘 마을 전체) */
export function plazaNews(viewerId: string | null, houses: readonly HousePosts[], village: readonly PlazaPost[], now = new Date()): PlazaNews {
  const mine = viewerId ? neighborNews(houses, now) : [];
  const posts = (mine.length > 0 ? mine : village.slice(0, PLAZA_NEWS_SIZE)).map((p) => ({ ...p, fresh: isFreshPost(p.createdAt, now) }));
  return { scope: mine.length > 0 ? "neighbors" : "village", posts, todayCount: countToday(posts, now) };
}

/** 24시간 안에 쓴 글 (서랍의 불 켜진 창) */
export function isFreshPost(createdAt: string, now = new Date()): boolean {
  return now.getTime() - Date.parse(createdAt) < FRESH_POST_HOURS * 3_600_000;
}

/** 살아 있는 게시판의 쪽지 수: 마을에 선 집들의 오늘 공개 글 수 (집마다 우체통 3편 안에서), 5장까지 */
export function boardPapers(houses: readonly Pick<HousePosts, "recentPosts">[], now = new Date()): number {
  return Math.min(BOARD_PAPERS_MAX, houses.reduce((sum, h) => sum + countToday(h.recentPosts, now), 0));
}

/** 오늘 하루 한 번 루프의 상태 (서버가 원장·낚시 기록·글에서 한 번에 읽는다, `getTodayState`) */
export type TodayState = {
  /** 오늘 출석 보상을 받았다 (GAME-04, 화면을 열면 저절로) */
  attended: boolean;
  /** 오늘 받은 글쓰기 보상 수 (point_ledger reason='post': 공개·새 글·100자 이상) */
  postRewards: number;
  /** 오늘 공개 글을 1편 이상 썼다 (보상과 상관없이) */
  postedToday: boolean;
  /** 오늘 낚시를 했다 (TOWN-14, 하루 한 번) */
  fished: boolean;
  /** 오늘 받은 동물 돌보기 보상 수 (point_ledger reason='farm_care') */
  farmCares: number;
  /** 오늘 더 돌볼 수 있는 동물이 있다 (부화했고 다 자라지 않았고, 오늘 돌보기를 다 하지 않은 동물) */
  canCare: boolean;
};

/** 오늘 할 일 한 줄. `spot`이 있으면 PC 광장에서 그 장소 앞으로 텔레포트한다 (`townSpots` 장소 id) */
export type TodayTask = {
  id: "attendance" | "post" | "fishing" | "farm";
  icon: string;
  label: string;
  done: boolean;
  progress: { current: number; total: number };
  href: string;
  spot?: ReturnSpot;
};

/** 낚시는 하루 한 번 (fishing_catches 기본 키가 회원·날짜) */
export const FISHING_DAILY_LIMIT = 1;

/**
 * 오늘 할 일: 이미 있는 하루 루프와 그 보상·상한만 보여 준다 (새 보상 없음).
 * 글쓰기는 보상 n/3을 세지만, 짧은 글이라 보상을 못 받았어도 오늘 공개 글을 썼으면 한 것으로 친다.
 * 돌보기 보상 15번은 키우는 동물이 5마리여야 채울 수 있어서, 오늘 한 번이라도 돌봤고 더 돌볼 동물이 없으면 한 것으로 친다.
 * 출석은 텔레포트하지 않는다: 게시판 앞은 마을 소식·출석 두 입구 한가운데라 Space가 마을 소식으로 들어간다 (링크로 출석 화면).
 */
export function todayTasks(state: TodayState): TodayTask[] {
  const postCap = REWARD_RULES.post.dailyLimit;
  const careCap = REWARD_RULES.farm_care.dailyLimit;
  return [
    { id: "attendance", icon: "📮", label: "출석 도장", done: state.attended, progress: { current: state.attended ? 1 : 0, total: 1 }, href: "/attendance" },
    {
      id: "post",
      icon: "✏️",
      label: "공개 글 쓰기",
      done: state.postedToday || state.postRewards > 0,
      progress: { current: Math.min(state.postRewards, postCap), total: postCap },
      href: "/write",
    },
    { id: "fishing", icon: "🎣", label: "낚시 한 번", done: state.fished, progress: { current: state.fished ? 1 : 0, total: FISHING_DAILY_LIMIT }, href: "/fishing", spot: "pond" },
    {
      id: "farm",
      icon: "🐮",
      label: "동물 돌보기",
      done: state.farmCares >= careCap || (state.farmCares > 0 && !state.canCare),
      progress: { current: Math.min(state.farmCares, careCap), total: careCap },
      href: "/farm",
      spot: "farm",
    },
  ];
}

/** 진행 문구: 글쓰기는 보상이라고 꼭 적는다 (`보상 1/3`) */
export function taskProgressText(task: TodayTask): string {
  const n = `${task.progress.current}/${task.progress.total}`;
  if (task.id === "post") return `글 보상 ${n}`;
  if (task.id === "farm") return `돌보기 보상 ${n}`;
  return task.done ? "오늘 했어요" : "아직이에요";
}

/** 문자열 씨앗 → 0 이상 2^32 미만 정수 (FNV-1a 뒤에 murmur3 마무리 섞기: 끝 글자만 다른 씨앗도 고르게 흩어진다) */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * 하루 동안 같은 n개를 고른다 (방문자 마을: 새로고침마다 집이 바뀌지 않고 하루 동안 같은 마을이 선다).
 * 하나마다 `{날짜}:{key}` 씨앗으로 순위를 매겨 작은 것부터 고르므로 입력 순서와 상관없다. 후보(인기 100곳)는 방문 수로
 * 자주 순서가 바뀌고 하나씩 빠지거나 들어오지만, 남은 후보끼리의 순위는 그대로라 고른 것이 많아야 하나 바뀐다. 원래 배열은 그대로 둔다.
 */
export function dailyPick<T>(items: readonly T[], day: string, key: (item: T) => string | number, n: number): T[] {
  return items
    .map((item) => {
      const k = String(key(item));
      return { item, k, rank: hashSeed(`${day}:${k}`) };
    })
    .sort((a, b) => a.rank - b.rank || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
    .slice(0, n)
    .map((r) => r.item);
}

const clockFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** 장소 간판 시계: 한국 시각을 하늘 이름과 12시간으로 (`밤 9:41`, `낮 2:05`). 하늘을 고정했으면(`?sky=`) 그 이름 */
export function clockText(now: Date, sky: Sky | null = null): string {
  const [h, m] = clockFormat.format(now).split(":");
  const hour = Number(h) % 12 === 0 ? 12 : Number(h) % 12;
  return `${SKY_LABELS[sky ?? skyAt(now)]} ${hour}:${m}`;
}
