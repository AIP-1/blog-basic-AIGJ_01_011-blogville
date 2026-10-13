import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { blogs, profiles, users } from "@/db/schema";

/**
 * 같은 이름을 잡으려는 트랜잭션들을 줄 세운다 (트랜잭션이 끝나면 풀린다).
 * 아이디·블로그 주소·닉네임은 서로 겹칠 수 없어서(AUTH-03) 표를 넘는 잠금이 필요하다.
 */
export async function lockName(tx: Tx, name: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"name:" + name.toLowerCase()}))`);
}

type Conflict = "username" | "slug" | "nickname" | null;

/**
 * 다른 회원의 아이디·블로그 주소(대소문자 무시)나 닉네임과 겹치는지.
 * `exceptUserId`는 자기 값을 빼고 볼 때 쓴다.
 * `nicknameExact`: 닉네임끼리는 글자 그대로 비교한다 (BLOG-03).
 */
export async function findNameConflict(
  tx: Tx,
  name: string,
  { exceptUserId, checkNicknames = true }: { exceptUserId?: string; checkNicknames?: boolean } = {},
): Promise<Conflict> {
  const lower = name.toLowerCase();
  const notMe = <T extends typeof users.id | typeof blogs.ownerId | typeof profiles.userId>(col: T) =>
    exceptUserId ? ne(col, exceptUserId) : undefined;

  const [user] = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(sql`lower(${users.username})`, lower), notMe(users.id)))
    .limit(1);
  if (user) return "username";

  const [blog] = await tx
    .select({ id: blogs.id })
    .from(blogs)
    .where(and(eq(sql`lower(${blogs.slug})`, lower), notMe(blogs.ownerId)))
    .limit(1);
  if (blog) return "slug";

  if (checkNicknames) {
    const [profile] = await tx
      .select({ id: profiles.userId })
      .from(profiles)
      .where(and(eq(profiles.nickname, name), notMe(profiles.userId)))
      .limit(1);
    if (profile) return "nickname";
  }
  return null;
}

/** UNIQUE 위반 (동시에 같은 이름을 잡은 경우의 마지막 방어선) */
export function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}
