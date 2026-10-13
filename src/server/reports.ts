import "server-only";
import { and, count, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { blogs, comments, guestbookEntries, posts, profiles, replies, reports, users } from "@/db/schema";
import { ADMIN_PAGE_SIZE, type AdminResult } from "@/lib/admin-rules";
import { isCommentHidden, isReplyHidden } from "@/lib/comment-rules";
import { isEntryHidden } from "@/lib/guestbook-rules";
import {
  canReportMore,
  REPORT_ERRORS,
  REPORT_MESSAGES,
  REPORT_TARGET_LABELS,
  reportTargetError,
  type ReportInput,
  type ReportReason,
  type ReportResult,
  type ReportTarget,
} from "@/lib/report-rules";
import { blindPost, deleteContent, writeAudit } from "./admin-tools";
import type { Member } from "./dal";

// 신고하기 (specs/059-report-bookmarks). 신고자는 로그인 세션으로만 정한다: 폼에서는 대상 종류·ID·사유만 받는다.

type Viewer = Pick<Member, "userId" | "role">;
type Found = { visible: boolean; authorId: string | null } | null;

/**
 * 신고할 대상을 찾아 이 회원에게 보이는지와 작성자를 돌려준다. 보이는 기준은 화면과 같다:
 * 글은 공개 글이거나 내 글, 댓글·답글은 그 글이 보이고 지우지 않았고 비밀이면 볼 수 있는 사람, 방명록은 비밀이면 볼 수 있는 사람.
 */
async function findTarget(tx: Tx, viewer: Viewer, type: ReportTarget, id: number): Promise<Found> {
  const postVisible = (isPublic: boolean, ownerId: string) => isPublic || ownerId === viewer.userId;
  if (type === "post") {
    const [row] = await tx
      .select({ isPublic: posts.isPublic, ownerId: blogs.ownerId })
      .from(posts)
      .innerJoin(blogs, eq(blogs.id, posts.blogId))
      .where(eq(posts.id, id));
    return row ? { visible: postVisible(row.isPublic, row.ownerId), authorId: row.ownerId } : null;
  }
  if (type === "comment") {
    const [row] = await tx
      .select({ c: comments, isPublic: posts.isPublic, ownerId: blogs.ownerId })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.postId))
      .innerJoin(blogs, eq(blogs.id, posts.blogId))
      .where(eq(comments.id, id));
    if (!row) return null;
    const visible = postVisible(row.isPublic, row.ownerId) && row.c.deletedAt === null && !isCommentHidden(viewer, row.ownerId, row.c);
    return { visible, authorId: row.c.authorId };
  }
  if (type === "reply") {
    const [row] = await tx
      .select({ r: replies, parent: { authorId: comments.authorId, isSecret: comments.isSecret }, isPublic: posts.isPublic, ownerId: blogs.ownerId })
      .from(replies)
      .innerJoin(comments, eq(comments.id, replies.commentId))
      .innerJoin(posts, eq(posts.id, comments.postId))
      .innerJoin(blogs, eq(blogs.id, posts.blogId))
      .where(eq(replies.id, id));
    if (!row) return null;
    const visible = postVisible(row.isPublic, row.ownerId) && row.r.deletedAt === null && !isReplyHidden(viewer, row.ownerId, row.r, row.parent);
    return { visible, authorId: row.r.authorId };
  }
  const [row] = await tx
    .select({ e: guestbookEntries, ownerId: blogs.ownerId })
    .from(guestbookEntries)
    .innerJoin(blogs, eq(blogs.id, guestbookEntries.blogId))
    .where(eq(guestbookEntries.id, id));
  return row ? { visible: !isEntryHidden(viewer, row.ownerId, row.e), authorId: row.e.authorId } : null;
}

/**
 * 신고 저장. 볼 수 없는 것·내 것은 거절, 같은 대상을 또 신고하면 `이미 신고했어요`.
 * 1시간에 10번까지: 회원 행을 잠가 동시에 보낸 신고도 한도를 넘지 않게 센다.
 */
export async function createReport(viewer: Viewer, input: ReportInput): Promise<ReportResult> {
  return db.transaction(async (tx) => {
    const locked = await tx.select({ id: users.id }).from(users).where(eq(users.id, viewer.userId)).for("update");
    if (locked.length === 0) return { ok: false, error: REPORT_ERRORS.notFound };
    const error = reportTargetError(await findTarget(tx, viewer, input.targetType, input.targetId), viewer.userId);
    if (error) return { ok: false, error };
    const [dup] = await tx
      .select({ id: reports.id })
      .from(reports)
      .where(and(eq(reports.reporterId, viewer.userId), eq(reports.targetType, input.targetType), eq(reports.targetId, input.targetId)));
    if (dup) return { ok: true, message: REPORT_MESSAGES.already };
    const [{ n }] = await tx
      .select({ n: count() })
      .from(reports)
      .where(and(eq(reports.reporterId, viewer.userId), gt(reports.createdAt, sql`now() - interval '1 hour'`)));
    if (!canReportMore(n)) return { ok: false, error: REPORT_ERRORS.tooMany };
    const added = await tx
      .insert(reports)
      .values({ reporterId: viewer.userId, targetType: input.targetType, targetId: input.targetId, reason: input.reason, detail: input.detail })
      .onConflictDoNothing()
      .returning({ id: reports.id });
    return { ok: true, message: added.length > 0 ? REPORT_MESSAGES.done : REPORT_MESSAGES.already };
  });
}

// ── 관리자 (requireAdmin 뒤에서만 부른다) ──────────────────

/** 대시보드: 처리하지 않은 신고 수 (신고 건수, 대상 수) */
export async function countOpenReports() {
  const [row] = await db
    .select({ reports: count(), targets: sql<number>`count(distinct (${reports.targetType}, ${reports.targetId}))::int` })
    .from(reports)
    .where(eq(reports.status, "open"));
  return row;
}

export type ReportGroup = {
  targetType: ReportTarget;
  targetId: number;
  count: number;
  lastAt: Date;
  reasons: ReportReason[];
  /** 기타 사유의 설명들 (최근 순) */
  details: string[];
  /** 대상이 지금 남아 있는지 (지워졌으면 기각으로 정리만 한다) */
  exists: boolean;
  text: string;
  title: string | null;
  link: string | null;
  author: { nickname: string | null; username: string | null };
  isSecret: boolean;
  blinded: boolean;
};

/** 처리하지 않은 신고를 대상별로 묶어 최근 신고 순으로 한 쪽 */
export async function listOpenReports(page: number): Promise<{ items: ReportGroup[]; total: number }> {
  const open = eq(reports.status, "open");
  const [groups, [{ total }]] = await Promise.all([
    db
      .select({
        targetType: reports.targetType,
        targetId: reports.targetId,
        count: sql<number>`count(*)::int`,
        lastAt: sql<string>`max(${reports.createdAt})`,
        reasons: sql<ReportReason[]>`array_agg(${reports.reason} order by ${reports.createdAt} desc)`,
        details: sql<(string | null)[]>`array_agg(${reports.detail} order by ${reports.createdAt} desc)`,
      })
      .from(reports)
      .where(open)
      .groupBy(reports.targetType, reports.targetId)
      .orderBy(desc(sql`max(${reports.createdAt})`), reports.targetType, reports.targetId)
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE),
    db.select({ total: sql<number>`count(distinct (${reports.targetType}, ${reports.targetId}))::int` }).from(reports).where(open),
  ]);
  const ids = (type: ReportTarget) => groups.filter((g) => g.targetType === type).map((g) => g.targetId);
  const author = { nickname: profiles.nickname, username: users.username };
  const none = [] as never[];
  const [postRows, commentRows, replyRows, entryRows] = await Promise.all([
    ids("post").length
      ? db
          .select({ id: posts.id, title: posts.title, text: sql<string>`left(${posts.contentText}, 200)`, isPublic: posts.isPublic, blindedAt: posts.blindedAt, slug: blogs.slug, ...author })
          .from(posts)
          .innerJoin(blogs, eq(blogs.id, posts.blogId))
          .leftJoin(users, eq(users.id, blogs.ownerId))
          .leftJoin(profiles, eq(profiles.userId, blogs.ownerId))
          .where(inArray(posts.id, ids("post")))
      : none,
    ids("comment").length
      ? db
          .select({ id: comments.id, content: comments.content, isSecret: comments.isSecret, deletedAt: comments.deletedAt, postId: posts.id, postTitle: posts.title, isPublic: posts.isPublic, slug: blogs.slug, ...author })
          .from(comments)
          .innerJoin(posts, eq(posts.id, comments.postId))
          .innerJoin(blogs, eq(blogs.id, posts.blogId))
          .leftJoin(users, eq(users.id, comments.authorId))
          .leftJoin(profiles, eq(profiles.userId, comments.authorId))
          .where(inArray(comments.id, ids("comment")))
      : none,
    ids("reply").length
      ? db
          .select({ id: replies.id, content: replies.content, isSecret: replies.isSecret, deletedAt: replies.deletedAt, postId: posts.id, postTitle: posts.title, isPublic: posts.isPublic, slug: blogs.slug, ...author })
          .from(replies)
          .innerJoin(comments, eq(comments.id, replies.commentId))
          .innerJoin(posts, eq(posts.id, comments.postId))
          .innerJoin(blogs, eq(blogs.id, posts.blogId))
          .leftJoin(users, eq(users.id, replies.authorId))
          .leftJoin(profiles, eq(profiles.userId, replies.authorId))
          .where(inArray(replies.id, ids("reply")))
      : none,
    ids("guestbook").length
      ? db
          .select({ id: guestbookEntries.id, content: guestbookEntries.content, isSecret: guestbookEntries.isSecret, slug: blogs.slug, blogTitle: blogs.title, ...author })
          .from(guestbookEntries)
          .innerJoin(blogs, eq(blogs.id, guestbookEntries.blogId))
          .leftJoin(users, eq(users.id, guestbookEntries.authorId))
          .leftJoin(profiles, eq(profiles.userId, guestbookEntries.authorId))
          .where(inArray(guestbookEntries.id, ids("guestbook")))
      : none,
  ]);

  const items = groups.map((g): ReportGroup => {
    const base = {
      targetType: g.targetType,
      targetId: g.targetId,
      count: Number(g.count),
      lastAt: new Date(g.lastAt),
      reasons: g.reasons,
      details: g.details.filter((d): d is string => d !== null),
    };
    const gone: ReportGroup = { ...base, exists: false, text: "", title: null, link: null, author: { nickname: null, username: null }, isSecret: false, blinded: false };
    if (g.targetType === "post") {
      const p = postRows.find((r) => r.id === g.targetId);
      if (!p) return gone;
      // 비공개 글은 관리자에게도 글 화면이 404라 링크가 없다
      return { ...base, exists: true, text: p.text, title: p.title, link: p.isPublic ? `/@${p.slug}/${p.id}` : null, author: p, isSecret: false, blinded: p.blindedAt !== null };
    }
    if (g.targetType === "guestbook") {
      const e = entryRows.find((r) => r.id === g.targetId);
      if (!e) return gone;
      return { ...base, exists: true, text: e.content, title: `${e.blogTitle} 방명록`, link: `/@${e.slug}/guestbook#entry-${e.id}`, author: e, isSecret: e.isSecret, blinded: false };
    }
    const rows = g.targetType === "comment" ? commentRows : replyRows;
    const c = rows.find((r) => r.id === g.targetId);
    if (!c || c.deletedAt) return gone;
    return {
      ...base,
      exists: true,
      text: c.content,
      title: c.postTitle,
      link: c.isPublic ? `/@${c.slug}/${c.postId}#${g.targetType}-${c.id}` : null,
      author: c,
      isSecret: c.isSecret,
      blinded: false,
    };
  });
  return { items, total: Number(total) };
}

/** 그 대상의 처리하지 않은 신고를 모두 처리됨(resolved)·기각(dismissed)으로. 바뀐 수 */
async function closeReports(tx: Tx | typeof db, adminId: string, type: ReportTarget, id: number, status: "resolved" | "dismissed"): Promise<number> {
  const rows = await tx
    .update(reports)
    .set({ status, resolvedBy: adminId, resolvedAt: sql`now()` })
    .where(and(eq(reports.targetType, type), eq(reports.targetId, id), eq(reports.status, "open")))
    .returning({ id: reports.id });
  return rows.length;
}

const NO_OPEN = { ok: false, error: "처리할 신고가 없어요" } as const;

async function hasOpen(type: ReportTarget, id: number) {
  const [row] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(and(eq(reports.targetType, type), eq(reports.targetId, id), eq(reports.status, "open")))
    .limit(1);
  return row !== undefined;
}

/** 신고된 글 블라인드: 기존 블라인드(관리 기록 포함)를 그대로 쓰고, 그 글의 신고를 모두 처리됨으로 */
export async function blindReportedPost(adminId: string, postId: number, reason: string): Promise<AdminResult> {
  if (!(await hasOpen("post", postId))) return NO_OPEN;
  const result = await blindPost(adminId, postId, reason);
  if (!result.ok) return result;
  const n = await closeReports(db, adminId, "post", postId, "resolved");
  return { ok: true, message: `글을 가리고 신고 ${n}건을 처리했어요` };
}

/** 신고된 대상 삭제: 콘텐츠 관리의 삭제(관리 기록 포함)와 같은 방식. 이미 지워졌어도 신고는 처리됨으로 */
export async function deleteReported(admin: Member, type: ReportTarget, id: number): Promise<AdminResult> {
  if (!(await hasOpen(type, id))) return NO_OPEN;
  const removed = await deleteContent(admin, [{ kind: type, id }]);
  const n = await closeReports(db, admin.userId, type, id, "resolved");
  return { ok: true, message: removed > 0 ? `${REPORT_TARGET_LABELS[type]}을 지우고 신고 ${n}건을 처리했어요` : `이미 지워진 ${REPORT_TARGET_LABELS[type]}이에요. 신고 ${n}건을 정리했어요` };
}

/** 기각: 그 대상의 신고를 모두 기각하고 관리 기록을 남긴다 (같은 트랜잭션) */
export async function dismissReports(adminId: string, type: ReportTarget, id: number): Promise<AdminResult> {
  return db.transaction(async (tx) => {
    const n = await closeReports(tx, adminId, type, id, "dismissed");
    if (n === 0) return NO_OPEN;
    await writeAudit(tx, adminId, "dismiss_reports", { type, id, label: `${REPORT_TARGET_LABELS[type]} #${id}` }, `신고 ${n}건 기각`);
    return { ok: true, message: `신고 ${n}건을 기각했어요` };
  });
}

