import "server-only";
import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { feedback, profiles, users } from "@/db/schema";
import {
  ADMIN_FEEDBACK_PAGE_SIZE,
  FEEDBACK_ERRORS,
  FEEDBACK_PAGE_SIZE,
  isRateLimited,
  nextStatus,
  rateWindowStart,
  shouldNotifyReply,
  type FeedbackChange,
  type FeedbackInput,
  type FeedbackKind,
  type FeedbackStatus,
} from "@/lib/support-rules";
import { lockMemberRow } from "./comments";
import { notifyFeedbackReply } from "./notifications";

// 버그·문의 (SUP-02~04, specs/057-support). 누가 쓰는지는 로그인 세션, 누가 답하는지는 관리자 확인·API 열쇠로 정한다.

type Result = { ok: true } | { ok: false; error: string };

export type MyFeedback = {
  id: number;
  kind: FeedbackKind;
  title: string;
  content: string;
  status: FeedbackStatus;
  reply: string | null;
  repliedAt: Date | null;
  createdAt: Date;
};

/**
 * 문의 쓰기 (SUP-02). 회원 행을 잠근 뒤 지난 한 시간에 보낸 수를 세어, 5개면 거절한다
 * (같은 회원이 동시에 보내도 잠금 순서대로 세어 6번째가 들어가지 않는다).
 */
export async function createFeedback(
  userId: string,
  input: FeedbackInput & { pagePath: string | null; userAgent: string | null },
  now: Date = new Date(),
): Promise<Result> {
  return db.transaction(async (tx) => {
    if (!(await lockMemberRow(tx, userId))) return { ok: false, error: FEEDBACK_ERRORS.invalid };
    const [{ n }] = await tx
      .select({ n: count() })
      .from(feedback)
      .where(and(eq(feedback.userId, userId), gte(feedback.createdAt, rateWindowStart(now))));
    if (isRateLimited(n)) return { ok: false, error: FEEDBACK_ERRORS.rateLimited };
    await tx.insert(feedback).values({ userId, ...input });
    return { ok: true };
  });
}

/** 내 문의 (최신순 10개씩) */
export async function listMyFeedback(userId: string, page: number): Promise<{ items: MyFeedback[]; total: number }> {
  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: feedback.id,
        kind: feedback.kind,
        title: feedback.title,
        content: feedback.content,
        status: feedback.status,
        reply: feedback.reply,
        repliedAt: feedback.repliedAt,
        createdAt: feedback.createdAt,
      })
      .from(feedback)
      .where(eq(feedback.userId, userId))
      .orderBy(desc(feedback.createdAt), desc(feedback.id))
      .limit(FEEDBACK_PAGE_SIZE)
      .offset((page - 1) * FEEDBACK_PAGE_SIZE),
    db.select({ total: count() }).from(feedback).where(eq(feedback.userId, userId)),
  ]);
  return { items, total };
}

export type AdminFeedback = MyFeedback & {
  pagePath: string | null;
  userAgent: string | null;
  repliedBy: "admin" | "bot" | null;
  username: string | null;
  nickname: string | null;
};

/** 관리자 화면 (SUP-03): 상태로 거르고 최신순 20개씩 */
export async function listFeedbackForAdmin(status: FeedbackStatus | null, page: number): Promise<{ items: AdminFeedback[]; total: number }> {
  const where = status ? eq(feedback.status, status) : undefined;
  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: feedback.id,
        kind: feedback.kind,
        title: feedback.title,
        content: feedback.content,
        status: feedback.status,
        reply: feedback.reply,
        repliedAt: feedback.repliedAt,
        repliedBy: feedback.repliedBy,
        createdAt: feedback.createdAt,
        pagePath: feedback.pagePath,
        userAgent: feedback.userAgent,
        username: users.username,
        nickname: profiles.nickname,
      })
      .from(feedback)
      .innerJoin(users, eq(users.id, feedback.userId))
      .leftJoin(profiles, eq(profiles.userId, feedback.userId))
      .where(where)
      .orderBy(desc(feedback.createdAt), desc(feedback.id))
      .limit(ADMIN_FEEDBACK_PAGE_SIZE)
      .offset((page - 1) * ADMIN_FEEDBACK_PAGE_SIZE),
    db.select({ total: count() }).from(feedback).where(where),
  ]);
  return { items, total };
}

/** `/admin`의 새 문의(접수) 수 */
export async function countNewFeedback(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(feedback).where(eq(feedback.status, "new"));
  return row.n;
}

export type BotFeedback = {
  id: number;
  kind: FeedbackKind;
  title: string;
  content: string;
  pagePath: string | null;
  userAgent: string | null;
  status: FeedbackStatus;
  reply: string | null;
  createdAt: string;
  author: { username: string | null };
};

/** 자동 처리 API 목록 (SUP-04): 고른 상태들, 오래된 것부터. 쓴 사람은 아이디만 */
export async function listFeedbackForBot(statuses: FeedbackStatus[], limit: number): Promise<BotFeedback[]> {
  const rows = await db
    .select({
      id: feedback.id,
      kind: feedback.kind,
      title: feedback.title,
      content: feedback.content,
      pagePath: feedback.pagePath,
      userAgent: feedback.userAgent,
      status: feedback.status,
      reply: feedback.reply,
      createdAt: feedback.createdAt,
      username: users.username,
    })
    .from(feedback)
    .innerJoin(users, eq(users.id, feedback.userId))
    .where(inArray(feedback.status, statuses))
    .orderBy(feedback.createdAt, feedback.id)
    .limit(limit);
  return rows.map(({ username, createdAt, ...r }) => ({ ...r, createdAt: createdAt.toISOString(), author: { username } }));
}

/**
 * 문의 하나 바꾸기 (관리자 SUP-03·자동 처리 SUP-04): 상태·답변. 행을 잠그고 바꾼 뒤
 * 답변이 새로 달렸거나 `답변 완료`·`고침`이 되면 쓴 사람에게 알림 하나 (같은 트랜잭션).
 * reply가 `""`이면 답변을 지운다(관리자만). 없는 문의면 null.
 */
export async function updateFeedback(
  id: number,
  change: FeedbackChange,
  by: "admin" | "bot",
): Promise<{ id: number; status: FeedbackStatus; reply: string | null; repliedAt: Date | null; repliedBy: "admin" | "bot" | null; notified: boolean } | null> {
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select({ userId: feedback.userId, status: feedback.status, reply: feedback.reply, repliedAt: feedback.repliedAt, repliedBy: feedback.repliedBy })
      .from(feedback)
      .where(eq(feedback.id, id))
      .for("update");
    if (!before) return null;

    const status = nextStatus(before.status, change);
    let reply = before.reply;
    let repliedAt = before.repliedAt;
    let repliedBy = before.repliedBy;
    if (change.reply !== undefined) {
      if (change.reply === "") {
        reply = null;
        repliedAt = null;
        repliedBy = null;
      } else if (change.reply !== before.reply) {
        reply = change.reply;
        repliedAt = new Date();
        repliedBy = by;
      }
    }

    const [after] = await tx
      .update(feedback)
      .set({ status, reply, repliedAt, repliedBy, updatedAt: sql`now()` })
      .where(eq(feedback.id, id))
      .returning({ id: feedback.id, status: feedback.status, reply: feedback.reply, repliedAt: feedback.repliedAt, repliedBy: feedback.repliedBy });

    const notified = shouldNotifyReply(before, after);
    if (notified) await notifyFeedbackReply(tx, before.userId, id);
    return { ...after, notified };
  });
}
