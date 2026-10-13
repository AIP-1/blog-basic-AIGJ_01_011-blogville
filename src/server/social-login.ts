import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { isSocialProvider, type SocialProviderId } from "@/lib/social-login";

export type LinkedAccount = { providerId: SocialProviderId; linkedAt: Date };

/** 회원이 연동해 둔 소셜 계정 (AUTH-05). 아이디 로그인(credential)은 빼고 */
export async function listLinkedAccounts(userId: string): Promise<LinkedAccount[]> {
  const rows = await db
    .select({ providerId: accounts.providerId, linkedAt: accounts.createdAt })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), ne(accounts.providerId, "credential")));
  return rows.flatMap((r) => (isSocialProvider(r.providerId) ? [{ providerId: r.providerId, linkedAt: r.linkedAt }] : []));
}

export async function isLinked(userId: string, providerId: SocialProviderId): Promise<boolean> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, providerId)))
    .limit(1);
  return !!row;
}

/** 연동 해제. 아이디 로그인은 늘 남으므로 로그인할 길이 없어지지 않는다 */
export async function unlinkAccount(userId: string, providerId: SocialProviderId): Promise<void> {
  await db.delete(accounts).where(and(eq(accounts.userId, userId), eq(accounts.providerId, providerId)));
}
