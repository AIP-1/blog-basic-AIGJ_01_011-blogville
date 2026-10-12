import "server-only";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { accounts, comments, loginAttempts, replies, sessions, users } from "@/db/schema";

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
 * 비밀번호 바꾸기: 새 해시로 바꾸고, 지금 쓰는 세션만 남기고 다른 기기의 로그인을 끊는다 (한 트랜잭션).
 */
export async function changeMemberPassword(userId: string, keepSessionId: string, newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    await tx
      .update(accounts)
      .set({ password: hash, updatedAt: new Date() })
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")));
    await tx.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)));
  });
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

export type ResetResult = { ok: true; password: string } | { ok: false; error: string };

export const RESET_ERRORS = {
  notFound: "회원을 찾을 수 없어요.",
  admin: "관리자의 비밀번호는 초기화할 수 없어요.",
  noPassword: "아이디·비밀번호로 가입한 회원이 아니에요.",
} as const;

/**
 * 관리자 비밀번호 초기화 (AUTH-07 열린 질문): 임시 비밀번호로 바꾸고 그 회원의 모든 로그인과 로그인 실패 기록을 지운다 (한 트랜잭션).
 * 관리자 계정은 거절한다. 임시 비밀번호 원문은 돌려줄 뿐 어디에도 남기지 않는다.
 */
export async function resetMemberPassword(userId: string, tempPassword: string): Promise<ResetResult> {
  const hash = await hashPassword(tempPassword);
  return db.transaction(async (tx) => {
    const [user] = await tx.select({ username: users.username, role: users.role }).from(users).where(eq(users.id, userId)).for("update");
    if (!user) return { ok: false, error: RESET_ERRORS.notFound };
    if (user.role === "admin") return { ok: false, error: RESET_ERRORS.admin };
    const updated = await tx
      .update(accounts)
      .set({ password: hash, updatedAt: new Date() })
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
      .returning({ id: accounts.id });
    if (updated.length === 0) return { ok: false, error: RESET_ERRORS.noPassword };
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    if (user.username) await tx.delete(loginAttempts).where(eq(loginAttempts.username, user.username));
    return { ok: true, password: tempPassword };
  });
}
