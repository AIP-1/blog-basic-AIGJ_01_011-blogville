import "server-only";
import { verifyPassword } from "better-auth/crypto";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { accounts, comments, loginAttempts, replies, users } from "@/db/schema";

/** 아이디·비밀번호 로그인 수단의 비밀번호가 맞는지 */
export async function verifyMemberPassword(userId: string, password: string): Promise<boolean> {
  const [row] = await db
    .select({ hash: accounts.password })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential"), isNotNull(accounts.password)));
  if (!row?.hash) return false;
  return verifyPassword({ hash: row.hash, password });
}

/**
 * 탈퇴 전에 댓글·답글을 정리한다 (AUTH-06, SOC-02).
 * 내 답글과 답글 없는 내 댓글은 지우고, 남의 답글이 달린 내 댓글은 작성자·내용을 비운 자리만 남긴다.
 */
async function prepareCommentsForWithdrawal(tx: Tx, userId: string) {
  await tx.delete(replies).where(eq(replies.authorId, userId));
  await tx
    .update(comments)
    .set({ authorId: null, content: "", deletedAt: sql`coalesce(${comments.deletedAt}, now())` })
    .where(and(eq(comments.authorId, userId), sql`exists (select 1 from ${replies} r where r.comment_id = ${comments.id})`));
  await tx.delete(comments).where(eq(comments.authorId, userId));
}

/**
 * 회원 탈퇴: 한 트랜잭션으로 회원과 딸린 데이터를 지운다. 유예 없음.
 * 회원을 가리키는 표는 외래 키 ON DELETE CASCADE로 함께 지워진다 (로그인 수단·세션·프로필·블로그·글·첨부·이웃·공감).
 */
export async function deleteMember(userId: string, username: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from users where id = ${userId} for update`);
    await prepareCommentsForWithdrawal(tx, userId);
    await tx.delete(loginAttempts).where(eq(loginAttempts.username, username));
    await tx.delete(users).where(eq(users.id, userId));
  });
}
