import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles, users } from "@/db/schema";
import { BLOG_ERRORS } from "@/lib/blog-rules";
import { isUniqueViolation, lockName } from "./names";

/** 닉네임 바꾸기 (BLOG-03). 다른 회원의 아이디(대소문자 무시)·닉네임(글자 그대로)과 겹칠 수 없다. */
export async function updateNickname(userId: string, rawNickname: string): Promise<string | null> {
  const nickname = rawNickname.trim();
  try {
    return await db.transaction(async (tx) => {
      await lockName(tx, nickname);
      const [user] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(sql`lower(${users.username})`, nickname.toLowerCase()), ne(users.id, userId)))
        .limit(1);
      const [other] = await tx
        .select({ id: profiles.userId })
        .from(profiles)
        .where(and(eq(profiles.nickname, nickname), ne(profiles.userId, userId)))
        .limit(1);
      if (user || other) return BLOG_ERRORS.nicknameTaken;
      await tx.update(profiles).set({ nickname }).where(eq(profiles.userId, userId));
      return null;
    });
  } catch (e) {
    if (isUniqueViolation(e)) return BLOG_ERRORS.nicknameTaken;
    throw e;
  }
}
