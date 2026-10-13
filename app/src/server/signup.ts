import "server-only";
import { hashPassword } from "better-auth/crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { accounts, blogs, categories, houseFurniture, items, loginAttempts, profiles, userItems, users } from "@/db/schema";
import { STARTER_FURNITURE } from "@/lib/house";
import { STARTER_BACKGROUND } from "@/lib/shop";
import { AUTH_ERRORS } from "@/lib/auth-rules";
import { findNameConflict, isUniqueViolation, lockName } from "./names";
import { findStarterCharacter } from "./items";
import { grantReward } from "./points";

export class SignUpError extends Error {}

const newId = () => crypto.randomUUID().replace(/-/g, "");

/**
 * 가입 트랜잭션 (AUTH-07, BLOG-01, GAME-01): 회원·로그인 수단·고른 캐릭터·프로필·블로그·기본 카테고리 "일상"을 한 번에 만든다.
 * 하나라도 실패하면 전부 취소된다. 입력은 checkSignUp을 통과한 값이어야 한다.
 */
export async function createMember(input: { username: string; password: string; blogTitle: string; characterId: number }) {
  // 해시는 느리므로 트랜잭션(잠금) 밖에서 만든다
  const passwordHash = await hashPassword(input.password);
  const userId = newId();
  try {
    await db.transaction(async (tx) => {
      await lockName(tx, input.username);
      if (await findNameConflict(tx, input.username)) throw new SignUpError(AUTH_ERRORS.taken);
      // 고른 캐릭터가 기본 캐릭터인지 DB에서 다시 본다 (GAME-01)
      const characterId = await findStarterCharacter(tx, input.characterId);
      if (characterId === null) throw new SignUpError(AUTH_ERRORS.character);

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
      // 고른 캐릭터 1종을 받아 장착한다 (GAME-01)
      await tx.insert(userItems).values({ userId, itemId: characterId });
      await tx.insert(profiles).values({ userId, nickname: input.username, characterItemId: characterId });
      // 기본 배경 초원을 받아 미니룸에 건다 (SHOP-04)
      const [meadow] = await tx.select({ id: items.id }).from(items).where(eq(items.code, STARTER_BACKGROUND));
      if (meadow) await tx.insert(userItems).values({ userId, itemId: meadow.id });
      const [blog] = await tx
        .insert(blogs)
        .values({ ownerId: userId, slug: input.username, title: input.blogTitle.trim(), intro: "", backgroundItemId: meadow?.id ?? null })
        .returning({ id: blogs.id });
      await tx.insert(categories).values({ blogId: blog.id, name: "일상", position: 1 });
      // 기본 가구 2개를 받아 우리 집 0·1번 칸에 놓는다 (SHOP-05)
      const starters = await tx
        .select({ id: items.id, code: items.code })
        .from(items)
        .where(inArray(items.code, STARTER_FURNITURE.map((f) => f.code)));
      for (const f of STARTER_FURNITURE) {
        const item = starters.find((s) => s.code === f.code);
        if (!item) continue;
        await tx.insert(userItems).values({ userId, itemId: item.id });
        await tx.insert(houseFurniture).values({ userId, slot: f.slot, itemId: item.id });
      }
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
