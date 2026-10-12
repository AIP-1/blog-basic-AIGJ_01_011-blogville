import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { items, profiles } from "@/db/schema";

// 아이템·캐릭터 (GAME-01, specs/032-pixel-characters)

export type StarterCharacter = { id: number; name: string; art: string };

/** 가입 화면의 `캐릭터 고르기`: 기본 캐릭터, items.id 순서 */
export async function listStarterCharacters(): Promise<StarterCharacter[]> {
  return db
    .select({ id: items.id, name: items.name, art: items.art })
    .from(items)
    .where(and(eq(items.type, "character"), eq(items.isStarter, true)))
    .orderBy(asc(items.id));
}

/** 가입 트랜잭션에서 고른 ID를 다시 확인한다: 기본 캐릭터면 그 ID, 아니면 null */
export async function findStarterCharacter(tx: Tx, id: number): Promise<number | null> {
  const [row] = await tx
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.id, id), eq(items.type, "character"), eq(items.isStarter, true)));
  return row?.id ?? null;
}

/** 장착한 캐릭터의 그림 키와 이름 (없으면 null) */
export async function getCharacter(userId: string): Promise<{ art: string; name: string } | null> {
  const [row] = await db
    .select({ art: items.art, name: items.name })
    .from(profiles)
    .innerJoin(items, eq(items.id, profiles.characterItemId))
    .where(eq(profiles.userId, userId));
  return row ?? null;
}
