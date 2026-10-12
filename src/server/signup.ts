import "server-only";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, blogs, categories, loginAttempts, profiles, users } from "@/db/schema";
import { AUTH_ERRORS } from "@/lib/auth-rules";
import { findNameConflict, isUniqueViolation, lockName } from "./names";
import { grantReward } from "./points";

export class SignUpError extends Error {}

const newId = () => crypto.randomUUID().replace(/-/g, "");

/**
 * 가입 트랜잭션 (AUTH-07, BLOG-01): 회원·로그인 수단·프로필·블로그·기본 카테고리 "일상"을 한 번에 만든다.
 * 하나라도 실패하면 전부 취소된다. 입력은 checkSignUp을 통과한 값이어야 한다.
 */
export async function createMember(input: { username: string; password: string; blogTitle: string }) {
  // 해시는 느리므로 트랜잭션(잠금) 밖에서 만든다
  const passwordHash = await hashPassword(input.password);
  const userId = newId();
  try {
    await db.transaction(async (tx) => {
      await lockName(tx, input.username);
      if (await findNameConflict(tx, input.username)) throw new SignUpError(AUTH_ERRORS.taken);

      await tx.insert(users).values({
        id: userId,
        username: input.username,
        displayUsername: input.username,
        email: `${input.username}@users.blogville.invalid`,
        name: input.username,
        role: "user",
      });
      await tx.insert(accounts).values({
        id: newId(),
        userId,
        accountId: userId,
        providerId: "credential",
        password: passwordHash,
      });
      await tx.delete(loginAttempts).where(eq(loginAttempts.username, input.username));
      await tx.insert(profiles).values({ userId, nickname: input.username });
      const [blog] = await tx
        .insert(blogs)
        .values({ ownerId: userId, slug: input.username, title: input.blogTitle.trim(), intro: "" })
        .returning({ id: blogs.id });
      await tx.insert(categories).values({ blogId: blog.id, name: "일상", position: 1 });
      // 가입 축하 🪙 100 (GAME-03·05)
      await grantReward(tx, userId, "signup");
    });
  } catch (error) {
    if (error instanceof SignUpError) throw error;
    if (isUniqueViolation(error)) throw new SignUpError(AUTH_ERRORS.taken);
    throw error;
  }
  return { userId };
}
