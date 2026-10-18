import "server-only";
import { and, desc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogs, posts, profiles } from "@/db/schema";
import { CARE_CODES } from "@/lib/farm";
import { todayKST } from "@/lib/kst";
import { viewedRecently } from "./stats";
import { PLAZA_NEWS_SIZE, plazaNews, type PlazaNews, type PlazaPost, type TodayState } from "@/lib/town/plaza";

// 광장 HUD의 서버 데이터 (광장 개편): 오늘 할 일 상태, 광장 소식 서랍의 글.
// /town에 더하는 쿼리는 둘뿐이다(오늘 상태 1, 마을 전체 새 글 1). 둘 다 이미 있는 Promise.all 안에서 돈다.

/** 한국 시간 오늘 0시 (points.ts의 하루 상한 기준과 같은 식) */
const startOfTodayKST = sql`(date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')`;

/**
 * 연속 출석 (gaps-and-islands): 최근 출석 날짜를 최신순으로 번호(rn) 매기면, 이어진 날들은 `date + rn`이 모두 같다.
 * 맨 앞 줄(오늘, 오늘 아직이면 어제)과 같은 묶음의 줄 수가 연속 날 수다. 그 앞 줄이 그저께보다 오래면 0.
 * attendances 기본 키(user_id, date)를 거꾸로 1년 치까지만 읽는다. 순수 함수 `attendanceStreak`와 같은 규칙.
 */
function attendanceStreakSql(userId: string, today: string) {
  return sql`select count(*) from (
      select a.date, a.date + (row_number() over (order by a.date desc))::int as grp
      from attendances a where a.user_id = ${userId} and a.date <= ${today}::date and a.date > ${today}::date - 366
    ) s
    where s.grp = (
      select a.date + 1 from attendances a where a.user_id = ${userId} and a.date <= ${today}::date and a.date >= ${today}::date - 1
      order by a.date desc limit 1
    )`;
}

/**
 * 오늘 할 일 상태를 한 번에 읽는다: 글쓰기·동물 돌보기 보상 수(원장), 출석 보상, 낚시 기록, 오늘 공개 글,
 * 그리고 오늘 더 돌볼 동물이 있는지(부화했고 다 자라지 않았고 오늘 돌보기를 다 하지 않은 동물, 농장의 `findGrowing`과 같은 조건).
 * 원장은 point_ledger_user_reason_created_idx, 글은 posts_blog_list_idx, 동물은 animals_user_idx를 탄다.
 */
export async function getTodayState(userId: string): Promise<TodayState> {
  const today = todayKST();
  const [row] = await db.execute<{
    post_rewards: number;
    farm_cares: number;
    comments: number;
    streak: number;
    attended: boolean;
    fished: boolean;
    posted: boolean;
    can_care: boolean;
  }>(sql`
    select
      (select count(*) from point_ledger l where l.user_id = ${userId} and l.reason = 'post' and l.created_at >= ${startOfTodayKST})::int as post_rewards,
      (select count(*) from point_ledger l where l.user_id = ${userId} and l.reason = 'comment' and l.created_at >= ${startOfTodayKST})::int as comments,
      (${attendanceStreakSql(userId, today)})::int as streak,
      (select count(*) from point_ledger l where l.user_id = ${userId} and l.reason = 'farm_care' and l.created_at >= ${startOfTodayKST})::int as farm_cares,
      exists (select 1 from point_ledger l where l.user_id = ${userId} and l.reason = 'attendance' and l.ref_id = ${today}) as attended,
      exists (select 1 from fishing_catches f where f.user_id = ${userId} and f.date = ${today}::date) as fished,
      exists (
        select 1 from posts p join blogs b on b.id = p.blog_id
        where b.owner_id = ${userId} and p.is_public and p.created_at >= ${startOfTodayKST}
      ) as posted,
      exists (
        select 1 from animals a
        where a.user_id = ${userId} and a.species is not null and a.grown_at is null
          and (select count(*) from animal_cares c where c.animal_id = a.id and c.date = ${today}::date) < ${CARE_CODES.length}
      ) as can_care`);
  return {
    postRewards: Number(row.post_rewards),
    farmCares: Number(row.farm_cares),
    comments: Number(row.comments),
    streak: Number(row.streak),
    attended: Boolean(row.attended),
    fished: Boolean(row.fished),
    postedToday: Boolean(row.posted),
    canCare: Boolean(row.can_care),
  };
}

/**
 * 마을 전체 새 글 (이웃 글이 없을 때의 서랍): 모든 블로그의 보이는 글(공개, 블라인드 아님, 예약 시각이 지남, 인기 글의 `visible`과 같다) 최신순 8편.
 * 기억하지 않는다: 글을 비공개로 돌리거나 블라인드하면 방문자 서랍에서도 바로 빠져야 한다. posts_recent_idx를 거꾸로 8편만 읽는다.
 */
export async function getVillageNews(now = new Date(), visitorId: string | null = null): Promise<PlazaPost[]> {
  const rows = await db
    .select({ id: posts.id, title: posts.title, createdAt: posts.createdAt, slug: blogs.slug, nickname: profiles.nickname, read: viewedRecently(posts.id, visitorId) })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .where(and(eq(posts.isPublic, true), isNull(posts.blindedAt), or(isNull(posts.publishAt), lte(posts.publishAt, now))))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(PLAZA_NEWS_SIZE);
  return rows.map(({ read, ...r }) => ({ ...r, createdAt: r.createdAt.toISOString(), ...(read ? { read: true } : {}) }));
}

/**
 * 광장 소식 서랍 (이웃 새 글): 마을에 집이 선 이웃의 7일 안 공개 글 8편을 집에 실려 온 우체통 글에서 고른다(쿼리 없음).
 * 이웃 글이 없거나 방문자면 마을 전체 새 글. `village`를 미리 받아 두었으면(페이지의 Promise.all) 그것을 쓴다.
 */
export async function getPlazaNews(
  viewerId: string | null,
  houses: Parameters<typeof plazaNews>[1],
  village?: readonly PlazaPost[],
): Promise<PlazaNews> {
  const news = plazaNews(viewerId, houses, village ?? []);
  if (news.scope === "village" && !village) return plazaNews(viewerId, houses, await getVillageNews());
  return news;
}
