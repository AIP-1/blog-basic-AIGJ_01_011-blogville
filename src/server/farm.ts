import "server-only";
import { randomInt } from "node:crypto";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { animalCares, animals, users } from "@/db/schema";
import { withJosa } from "@/lib/josa";
import { todayKST } from "@/lib/kst";
import {
  CARE_ACTIONS,
  EGG_PRICE,
  FARM_ERRORS,
  grownMessage,
  isSpecies,
  levelEggs,
  MAX_ACTIVE_ANIMALS,
  pickSpecies,
  POST_GROWTH,
  SPECIES,
  type CareAction,
  type Species,
} from "@/lib/farm";
import { addLedgerEntry, getWallet, grantReward, lockUser } from "./points";

// 동물 농장 (TOWN-09, specs/044-farm)

export type FarmEgg = { id: number; source: string };
export type FarmAnimal = { id: number; species: Species; growth: number; cared: CareAction[] };
export type GrownAnimal = { id: number; species: Species; grownAt: Date };

export type Farm = {
  eggs: FarmEgg[];
  animals: FarmAnimal[];
  grown: GrownAnimal[];
  /** 받을 수 있는 무료 알: 첫 알이면 "first", 레벨 보상 알이면 그 레벨 */
  freeEggs: ("first" | number)[];
  coins: number;
  level: number;
};

/** 내 농장: 알·키우는 동물(오늘 한 돌보기)·다 키운 동물·받을 수 있는 무료 알 */
export async function getFarm(userId: string): Promise<Farm> {
  const today = todayKST();
  const [rows, cares, wallet] = await Promise.all([
    db
      .select({ id: animals.id, species: animals.species, source: animals.source, sourceLevel: animals.sourceLevel, growth: animals.growth, grownAt: animals.grownAt })
      .from(animals)
      .where(eq(animals.userId, userId))
      .orderBy(asc(animals.id)),
    db
      .select({ animalId: animalCares.animalId, action: animalCares.action })
      .from(animalCares)
      .innerJoin(animals, eq(animals.id, animalCares.animalId))
      .where(and(eq(animals.userId, userId), eq(animalCares.date, today))),
    getWallet(userId),
  ]);
  const cared = (id: number) => cares.filter((c) => c.animalId === id).map((c) => c.action as CareAction);
  const level = wallet.progress.level;
  const claimed = rows.filter((r) => r.source === "level").map((r) => r.sourceLevel!);
  const freeEggs: ("first" | number)[] = [];
  if (!rows.some((r) => r.source === "first")) freeEggs.push("first");
  freeEggs.push(...levelEggs(level, claimed));
  return {
    eggs: rows.filter((r) => r.species === null).map((r) => ({ id: r.id, source: r.source })),
    animals: rows
      .filter((r) => isSpecies(r.species) && r.grownAt === null)
      .map((r) => ({ id: r.id, species: r.species as Species, growth: r.growth, cared: cared(r.id) })),
    grown: rows
      .filter((r) => isSpecies(r.species) && r.grownAt !== null)
      .map((r) => ({ id: r.id, species: r.species as Species, grownAt: r.grownAt! }))
      .sort((a, b) => b.grownAt.getTime() - a.grownAt.getTime() || b.id - a.id),
    freeEggs,
    coins: wallet.coin,
    level,
  };
}

/** 다 키운 동물 (블로그 도감에서 쓴다): 최근 것 먼저 */
export async function listGrownAnimals(userId: string): Promise<GrownAnimal[]> {
  const rows = await db
    .select({ id: animals.id, species: animals.species, grownAt: animals.grownAt })
    .from(animals)
    .where(and(eq(animals.userId, userId), isNotNull(animals.grownAt)))
    .orderBy(desc(animals.grownAt), desc(animals.id));
  return rows.map((r) => ({ id: r.id, species: r.species as Species, grownAt: r.grownAt! }));
}

export type FarmResult = { ok: true; message: string } | { ok: false; error: string };

/** 회원 행 KEY SHARE(탈퇴와 같은 순서) → 회원 잠금. 탈퇴한 회원이면 false */
async function lockMember(tx: Tx, userId: string): Promise<boolean> {
  const [member] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("key share");
  if (!member) return false;
  await lockUser(tx, userId);
  return true;
}

/** 다 자라지 않은 알·동물 수 (5마리 상한) */
async function activeCount(tx: Tx, userId: string): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(animals)
    .where(and(eq(animals.userId, userId), isNull(animals.grownAt)));
  return row.n;
}

/**
 * 무료 알 받기: `"first"`는 농장 첫 알(회원당 한 번), 숫자는 그 레벨 보상 알.
 * [잠금 → 자리 확인 → 레벨 확인 → 넣기(고유 인덱스가 두 번째 것을 막는다)]
 */
export async function claimEgg(userId: string, kind: "first" | number): Promise<FarmResult> {
  return db.transaction(async (tx) => {
    if (!(await lockMember(tx, userId))) return { ok: false, error: FARM_ERRORS.notYet };
    if (kind !== "first") {
      const { level } = (await getWallet(userId, tx)).progress;
      if (!levelEggs(level, []).includes(kind)) return { ok: false, error: FARM_ERRORS.notYet };
    }
    if ((await activeCount(tx, userId)) >= MAX_ACTIVE_ANIMALS) return { ok: false, error: FARM_ERRORS.full };
    const added = await tx
      .insert(animals)
      .values(kind === "first" ? { userId, source: "first" } : { userId, source: "level", sourceLevel: kind })
      .onConflictDoNothing()
      .returning({ id: animals.id });
    if (added.length === 0) return { ok: false, error: FARM_ERRORS.claimed };
    return { ok: true, message: kind === "first" ? "🥚 농장 첫 알을 받았어요!" : `🥚 레벨 ${kind} 보상 알을 받았어요!` };
  });
}

/** 알 사기: [잠금 → 자리·코인 확인 → 알 넣기 → 원장 `egg_purchase`(−100, ref = 알 ID)] */
export async function buyEgg(userId: string): Promise<FarmResult> {
  return db.transaction(async (tx) => {
    if (!(await lockMember(tx, userId))) return { ok: false, error: FARM_ERRORS.notYet };
    if ((await activeCount(tx, userId)) >= MAX_ACTIVE_ANIMALS) return { ok: false, error: FARM_ERRORS.full };
    const { coin } = await getWallet(userId, tx);
    if (coin < EGG_PRICE) return { ok: false, error: FARM_ERRORS.coins(EGG_PRICE - coin) };
    const [egg] = await tx.insert(animals).values({ userId, source: "buy" }).returning({ id: animals.id });
    await addLedgerEntry(tx, { userId, reason: "egg_purchase", expDelta: 0, coinDelta: -EGG_PRICE, refId: String(egg.id) });
    return { ok: true, message: `🥚 알을 샀어요! 🪙 −${EGG_PRICE}` };
  });
}

/** 부화: 내 알이면 종류를 비중대로 랜덤으로 정한다 */
export async function hatchEgg(userId: string, animalId: number): Promise<FarmResult> {
  return db.transaction(async (tx) => {
    if (!(await lockMember(tx, userId))) return { ok: false, error: FARM_ERRORS.notEgg };
    const species = pickSpecies(randomInt(100));
    const hatched = await tx
      .update(animals)
      .set({ species, hatchedAt: new Date() })
      .where(and(eq(animals.id, animalId), eq(animals.userId, userId), isNull(animals.species)))
      .returning({ id: animals.id });
    if (hatched.length === 0) return { ok: false, error: FARM_ERRORS.notEgg };
    return { ok: true, message: `🐣 ${withJosa(SPECIES[species].name, "이/가")} 태어났어요!` };
  });
}

/** 키우는(부화했고 다 자라지 않은) 내 동물. 잠금을 잡은 트랜잭션 안에서 */
async function findGrowing(tx: Tx, userId: string, animalId: number) {
  const [row] = await tx
    .select({ id: animals.id, species: animals.species, growth: animals.growth })
    .from(animals)
    .where(and(eq(animals.id, animalId), eq(animals.userId, userId), isNotNull(animals.species), isNull(animals.grownAt)));
  return row && isSpecies(row.species) ? { id: row.id, species: row.species, growth: row.growth } : null;
}

/**
 * 성장치를 더한다. 다 차면 `grown_at`을 적고 원장 `farm_grown`(종류별 경험치·코인, ref = 동물 ID)을 넣는다.
 * 다 자랐으면 축하 문구, 아니면 null. `lockUser`를 잡은 트랜잭션 안에서.
 */
export async function addGrowth(tx: Tx, userId: string, animal: { id: number; species: Species; growth: number }, amount: number): Promise<string | null> {
  const s = SPECIES[animal.species];
  const growth = Math.min(animal.growth + amount, s.growth);
  const grown = growth >= s.growth;
  await tx
    .update(animals)
    .set({ growth, ...(grown ? { grownAt: new Date() } : {}) })
    .where(eq(animals.id, animal.id));
  if (!grown) return null;
  await addLedgerEntry(tx, { userId, reason: "farm_grown", expDelta: s.exp, coinDelta: s.coin, refId: String(animal.id) });
  return grownMessage(animal.species);
}

/** 돌보기: 동물·돌보기마다 하루 한 번. 성장을 더하고 돌보기 보상(경험치 +2, 하루 15번)을 준다 */
export async function careAnimal(userId: string, animalId: number, action: CareAction): Promise<FarmResult> {
  return db.transaction(async (tx) => {
    if (!(await lockMember(tx, userId))) return { ok: false, error: FARM_ERRORS.notAnimal };
    const animal = await findGrowing(tx, userId, animalId);
    if (!animal) return { ok: false, error: FARM_ERRORS.notAnimal };
    const done = await tx.insert(animalCares).values({ animalId, action, date: todayKST() }).onConflictDoNothing().returning({ id: animalCares.animalId });
    if (done.length === 0) return { ok: false, error: FARM_ERRORS.cared(action) };
    const rewarded = await grantReward(tx, userId, "farm_care", String(animalId));
    const care = CARE_ACTIONS[action];
    const grown = await addGrowth(tx, userId, animal, care.growth);
    return { ok: true, message: grown ?? `${care.button} 완료! 성장 +${care.growth}${rewarded ? ", 경험치 +2" : ""}` };
  });
}

/** 글쓰기 보상을 받은 글: 키우는 동물이 모두 성장 +10. `savePost` 트랜잭션 안에서(잠금은 `grantReward`가 잡았다) */
export async function growForPost(tx: Tx, userId: string): Promise<void> {
  const rows = await tx
    .select({ id: animals.id, species: animals.species, growth: animals.growth })
    .from(animals)
    .where(and(eq(animals.userId, userId), isNotNull(animals.species), isNull(animals.grownAt)))
    .orderBy(asc(animals.id));
  for (const r of rows) if (isSpecies(r.species)) await addGrowth(tx, userId, { id: r.id, species: r.species, growth: r.growth }, POST_GROWTH);
}
