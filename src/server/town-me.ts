import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { NOTICE_SLUG } from "@/lib/names";
import { NEIGHBOR_HOUSES } from "./town";

/**
 * 내 집이 보이는 마을 수 (plaza-upgrade-2 C2, 글을 쓰고 마을로 돌아왔을 때의 축하 문구 '이웃 n명의 마을에서 내 집이 빛나요').
 * 회원 마을(`getMemberHouses`)은 그 회원이 ⭐ 즐겨찾는 이웃을 즐겨찾기 한 순서(created_at, 블로그 번호)대로 10채까지 세우므로,
 * 나를 즐겨찾는 회원 중 내 앞에 즐겨찾는 이웃이 10명 미만인 회원만 센다. 공지 블로그는 어느 마을에도 서지 않는다.
 * follows_followee_idx(나를 즐겨찾는 줄)와 기본 키(follower_id 앞자리, 그 회원의 즐겨찾기)를 타는 쿼리 하나다.
 */
export async function countVillagesShowingMe(userId: string): Promise<number> {
  const rows = await db.execute<{ n: number }>(sql`
    select count(*)::int as n
    from follows f
    join blogs mine on mine.owner_id = f.followee_id
    where f.followee_id = ${userId}
      and f.is_favorite
      and mine.slug <> ${NOTICE_SLUG}
      and (
        select count(*)
        from follows g
        join blogs b on b.owner_id = g.followee_id
        where g.follower_id = f.follower_id
          and g.is_favorite
          and b.slug <> ${NOTICE_SLUG}
          and (g.created_at, b.id) < (f.created_at, mine.id)
      ) < ${NEIGHBOR_HOUSES}
  `);
  return rows[0]?.n ?? 0;
}
