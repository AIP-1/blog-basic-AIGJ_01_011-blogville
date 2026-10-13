import "server-only";
import { and, count, desc, eq, gt, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { cache } from "react";
import { db, type Tx } from "@/db";
import { adminAudit, blogs, blogVisits, comments, feedback, guestbookEntries, posts, profiles, replies, sessions, siteSettings, users } from "@/db/schema";
import {
  ADMIN_ERRORS,
  ADMIN_PAGE_SIZE,
  AUDIT_ACTIONS,
  decodeNotice,
  lastDaysKST,
  likePattern,
  memberActionError,
  roleChangeError,
  snippet,
  suspendLabel,
  suspendUntil,
  type AdminResult,
  type AuditAction,
  type ContentRef,
  type SiteNotice,
  type StatRange,
  type SuspendDays,
} from "@/lib/admin-rules";
import { deleteMember } from "./account";
import { BANNED_KEY, clearBannedWordsCache, readBannedWords } from "./banned-words";
import { removeComment, removeReply } from "./comments";
import type { Member } from "./dal";
import { removeEntry } from "./guestbook";

// 관리자 보강 (ADM-01~07, specs/058-admin-tools). 부르는 쪽(Server Action·화면)이 먼저 requireAdmin()으로 관리자인지 본다.

// ── 관리 기록 (ADM-06) ─────────────────────────────────────

type AuditTarget = { type: (typeof adminAudit.$inferInsert)["targetType"]; id?: string | number | null; label: string };

/** 관리 기록 한 줄. 바꾸는 일과 같은 트랜잭션(tx)으로 쓰면 함께 남거나 함께 사라진다 */
export async function writeAudit(tx: Tx | typeof db, adminId: string, action: AuditAction, target: AuditTarget, detail: string | null = null) {
  await tx.insert(adminAudit).values({
    adminId,
    action,
    targetType: target.type,
    targetId: target.id == null ? null : String(target.id).slice(0, 64),
    targetLabel: (target.label.trim() || "-").slice(0, 200),
    detail: detail ? detail.slice(0, 1000) : null,
  });
}

export async function listAudit(opts: { action: AuditAction | null; page: number }) {
  const where = opts.action ? eq(adminAudit.action, opts.action) : undefined;
  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: adminAudit.id,
        action: adminAudit.action,
        targetType: adminAudit.targetType,
        targetId: adminAudit.targetId,
        targetLabel: adminAudit.targetLabel,
        detail: adminAudit.detail,
        createdAt: adminAudit.createdAt,
        admin: users.username,
      })
      .from(adminAudit)
      .leftJoin(users, eq(users.id, adminAudit.adminId))
      .where(where)
      .orderBy(desc(adminAudit.createdAt), desc(adminAudit.id))
      .limit(ADMIN_PAGE_SIZE)
      .offset((opts.page - 1) * ADMIN_PAGE_SIZE),
    db.select({ total: count() }).from(adminAudit).where(where),
  ]);
  return { items: items.map((r) => ({ ...r, actionLabel: AUDIT_ACTIONS[r.action as AuditAction] ?? r.action })), total };
}

// ── 통계 (ADM-03) ──────────────────────────────────────────

export type DailyStat = { day: string; signups: number; posts: number; comments: number; visits: number };

/** 최근 7·30일(한국 날짜) 날마다 가입자·글·댓글(답글 포함)·방문 수. 지운 글·댓글은 세지 않는다 */
export async function getDailyStats(range: StatRange): Promise<DailyStat[]> {
  const days = lastDaysKST(range);
  const since = sql`(${days[0]}::date::timestamp at time zone 'Asia/Seoul')`;
  const day = (col: SQL) => sql`to_char(${col} at time zone 'Asia/Seoul', 'YYYY-MM-DD')`;
  type Row = { d: string; n: number };
  const [signups, newPosts, newComments, visits] = await Promise.all([
    db.execute<Row>(sql`select ${day(sql`created_at`)} as d, count(*)::int as n from ${users} where created_at >= ${since} group by 1`),
    db.execute<Row>(sql`select ${day(sql`created_at`)} as d, count(*)::int as n from ${posts} where created_at >= ${since} group by 1`),
    db.execute<Row>(sql`
      select d, sum(n)::int as n from (
        select ${day(sql`created_at`)} as d, count(*) as n from ${comments} where created_at >= ${since} and deleted_at is null group by 1
        union all
        select ${day(sql`created_at`)} as d, count(*) as n from ${replies} where created_at >= ${since} and deleted_at is null group by 1
      ) t group by d`),
    db.execute<Row>(sql`select to_char(date, 'YYYY-MM-DD') as d, count(*)::int as n from ${blogVisits} where date >= ${days[0]}::date group by 1`),
  ]);
  const pick = (rows: Iterable<Row>) => new Map([...rows].map((r) => [r.d, Number(r.n)]));
  const [s, p, c, v] = [pick(signups), pick(newPosts), pick(newComments), pick(visits)];
  return days.map((d) => ({ day: d, signups: s.get(d) ?? 0, posts: p.get(d) ?? 0, comments: c.get(d) ?? 0, visits: v.get(d) ?? 0 }));
}

/** 최근 30일(오늘 포함) 방문이 많은 블로그 10개 */
export async function getTopBlogs(limit = 10) {
  const since = lastDaysKST(30)[0];
  return db
    .select({ blogId: blogs.id, slug: blogs.slug, title: blogs.title, nickname: profiles.nickname, visits: sql<number>`count(*)::int` })
    .from(blogVisits)
    .innerJoin(blogs, eq(blogs.id, blogVisits.blogId))
    .leftJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .where(sql`${blogVisits.date} >= ${since}::date`)
    .groupBy(blogs.id, profiles.nickname)
    .orderBy(desc(sql`count(*)`), blogs.id)
    .limit(limit);
}

/** 정지 중인 회원 수 · 블라인드 글 수 */
export async function getModerationCounts() {
  const [[s], [b]] = await Promise.all([
    db
      .select({ n: count() })
      .from(users)
      .where(gt(users.suspendedUntil, sql`now()`)),
    db.select({ n: count() }).from(posts).where(isNotNull(posts.blindedAt)),
  ]);
  return { suspended: s.n, blinded: b.n };
}

// ── 회원 (ADM-01) ──────────────────────────────────────────

export type MemberFilter = "all" | "suspended" | "admin";

export async function listMembers(opts: { query: string; filter: MemberFilter; page: number }) {
  const conds: (SQL | undefined)[] = [];
  if (opts.query) conds.push(or(ilike(users.username, likePattern(opts.query)), ilike(profiles.nickname, likePattern(opts.query))));
  if (opts.filter === "suspended") conds.push(gt(users.suspendedUntil, sql`now()`));
  if (opts.filter === "admin") conds.push(eq(users.role, "admin"));
  const where = and(...conds);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        userId: users.id,
        username: users.username,
        role: users.role,
        suspendedUntil: users.suspendedUntil,
        suspendReason: users.suspendReason,
        createdAt: users.createdAt,
        nickname: profiles.nickname,
        slug: blogs.slug,
        postCount: sql<number>`(select count(*)::int from ${posts} p where p.blog_id = ${blogs.id})`,
        lastSeen: sql<string | null>`(select max(s.updated_at) from ${sessions} s where s.user_id = ${users.id})`,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .leftJoin(blogs, eq(blogs.ownerId, users.id))
      .where(where)
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(ADMIN_PAGE_SIZE)
      .offset((opts.page - 1) * ADMIN_PAGE_SIZE),
    db.select({ total: count() }).from(users).leftJoin(profiles, eq(profiles.userId, users.id)).where(where),
  ]);
  return { items: rows.map((r) => ({ ...r, lastSeen: r.lastSeen ? new Date(r.lastSeen) : null })), total };
}

async function lockTarget(tx: Tx, userId: string) {
  const [row] = await tx.select({ id: users.id, username: users.username, role: users.role }).from(users).where(eq(users.id, userId)).for("update");
  return row ?? null;
}

/** 회원 정지: 기간 동안 로그인을 막고, 이미 로그인한 세션을 모두 끊는다. 나 자신·관리자는 거절 */
export async function suspendMember(adminId: string, userId: string, days: SuspendDays, reason: string): Promise<AdminResult> {
  return db.transaction(async (tx) => {
    const target = await lockTarget(tx, userId);
    if (!target) return { ok: false, error: ADMIN_ERRORS.notFound };
    const error = memberActionError({ actorId: adminId, targetId: userId, targetRole: target.role });
    if (error) return { ok: false, error };
    await tx
      .update(users)
      .set({ suspendedUntil: suspendUntil(days), suspendReason: reason })
      .where(eq(users.id, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await writeAudit(tx, adminId, "suspend", { type: "member", id: userId, label: target.username }, `${suspendLabel(days)} · ${reason}`);
    return { ok: true, message: `${target.username} 님을 정지했어요` };
  });
}

export async function unsuspendMember(adminId: string, userId: string): Promise<AdminResult> {
  return db.transaction(async (tx) => {
    const target = await lockTarget(tx, userId);
    if (!target) return { ok: false, error: ADMIN_ERRORS.notFound };
    await tx.update(users).set({ suspendedUntil: null, suspendReason: null }).where(eq(users.id, userId));
    await writeAudit(tx, adminId, "unsuspend", { type: "member", id: userId, label: target.username });
    return { ok: true, message: `${target.username} 님의 정지를 풀었어요` };
  });
}

/** 관리자 지정·해제. 내 역할은 바꿀 수 없고, 마지막 관리자는 해제할 수 없다 */
export async function setMemberRole(adminId: string, userId: string, role: "admin" | "user"): Promise<AdminResult> {
  return db.transaction(async (tx) => {
    // 관리자 수를 세는 동안 다른 관리자가 동시에 해제하지 못하게 관리자 행을 모두 잠근다
    const admins = await tx.select({ id: users.id }).from(users).where(eq(users.role, "admin")).for("update");
    const target = await lockTarget(tx, userId);
    if (!target) return { ok: false, error: ADMIN_ERRORS.notFound };
    const error = roleChangeError({ actorId: adminId, targetId: userId, targetRole: target.role, newRole: role, adminCount: admins.length });
    if (error) return { ok: false, error };
    if (target.role === role) return { ok: true, message: "이미 그렇게 되어 있어요" };
    // 정지된 회원을 관리자로 지정하면 정지도 함께 푼다 (관리자는 정지할 수 없다)
    await tx
      .update(users)
      .set(role === "admin" ? { role, suspendedUntil: null, suspendReason: null } : { role })
      .where(eq(users.id, userId));
    // 바뀐 권한은 다음 요청부터 바로 쓰인다 (세션은 요청마다 회원 행을 읽는다)
    await writeAudit(tx, adminId, role === "admin" ? "grant_admin" : "revoke_admin", { type: "member", id: userId, label: target.username });
    return { ok: true, message: role === "admin" ? `${target.username} 님을 관리자로 지정했어요` : `${target.username} 님의 관리자 권한을 해제했어요` };
  });
}

/** 강제 탈퇴: 회원 탈퇴(deleteMember)와 같은 정리. 나 자신·관리자는 거절 */
export async function forceDeleteMember(adminId: string, userId: string): Promise<AdminResult> {
  const [target] = await db.select({ username: users.username, role: users.role }).from(users).where(eq(users.id, userId));
  if (!target) return { ok: false, error: ADMIN_ERRORS.notFound };
  const error = memberActionError({ actorId: adminId, targetId: userId, targetRole: target.role });
  if (error) return { ok: false, error };
  await deleteMember(userId, target.username);
  await writeAudit(db, adminId, "delete_member", { type: "member", id: userId, label: target.username });
  return { ok: true, message: `${target.username} 님을 탈퇴시켰어요` };
}

// ── 콘텐츠 (ADM-02) ────────────────────────────────────────

export async function listPostsForAdmin(page: number) {
  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: posts.id,
        title: posts.title,
        text: sql<string>`left(${posts.contentText}, 120)`,
        isPublic: posts.isPublic,
        blindedAt: posts.blindedAt,
        blindReason: posts.blindReason,
        createdAt: posts.createdAt,
        slug: blogs.slug,
        blogTitle: blogs.title,
        nickname: profiles.nickname,
        username: users.username,
      })
      .from(posts)
      .innerJoin(blogs, eq(blogs.id, posts.blogId))
      .innerJoin(users, eq(users.id, blogs.ownerId))
      .leftJoin(profiles, eq(profiles.userId, blogs.ownerId))
      .orderBy(desc(posts.createdAt), desc(posts.id))
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE),
    db.select({ total: count() }).from(posts),
  ]);
  return { items, total };
}

export type AdminComment = {
  kind: "comment" | "reply";
  id: number;
  postId: number;
  postTitle: string;
  postPublic: boolean;
  blogSlug: string;
  content: string;
  nickname: string | null;
  username: string | null;
  isSecret: boolean;
  createdAt: Date;
};

/** 사이트 전체의 지우지 않은 댓글·답글, 최신순. 비밀 댓글도 관리자에게는 내용을 보인다 */
export async function listCommentsForAdmin(page: number): Promise<{ items: AdminComment[]; total: number }> {
  const all = sql`
    select 'comment' as kind, c.id, c.post_id, c.author_id, c.content, c.is_secret, c.created_at
    from ${comments} c where c.deleted_at is null
    union all
    select 'reply' as kind, r.id, c.post_id, r.author_id, r.content, r.is_secret, r.created_at
    from ${replies} r join ${comments} c on c.id = r.comment_id where r.deleted_at is null
  `;
  type Row = {
    kind: "comment" | "reply";
    id: number;
    post_id: number;
    post_title: string;
    post_public: boolean;
    blog_slug: string;
    content: string;
    nickname: string | null;
    username: string | null;
    is_secret: boolean;
    created_at: string | Date;
  };
  const [rows, [{ total }]] = await Promise.all([
    db.execute<Row>(sql`
      select t.kind, t.id, t.post_id, p.title as post_title, p.is_public as post_public, pb.slug as blog_slug, t.content, t.is_secret, pr.nickname, u.username, t.created_at
      from (${all}) t
      join ${posts} p on p.id = t.post_id
      join ${blogs} pb on pb.id = p.blog_id
      left join ${profiles} pr on pr.user_id = t.author_id
      left join ${users} u on u.id = t.author_id
      order by t.created_at desc, t.kind desc, t.id desc
      limit ${ADMIN_PAGE_SIZE} offset ${(page - 1) * ADMIN_PAGE_SIZE}
    `),
    db.execute<{ total: number }>(sql`select count(*)::int as total from (${all}) t`),
  ]);
  return {
    total: Number(total),
    items: [...rows].map((r) => ({
      kind: r.kind,
      id: r.id,
      postId: r.post_id,
      postTitle: r.post_title,
      postPublic: r.post_public,
      blogSlug: r.blog_slug,
      content: r.content,
      nickname: r.nickname,
      username: r.username,
      isSecret: r.is_secret,
      createdAt: new Date(r.created_at),
    })),
  };
}

export async function listGuestbookForAdmin(page: number) {
  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: guestbookEntries.id,
        content: guestbookEntries.content,
        isSecret: guestbookEntries.isSecret,
        reply: guestbookEntries.reply,
        createdAt: guestbookEntries.createdAt,
        slug: blogs.slug,
        blogTitle: blogs.title,
        nickname: profiles.nickname,
        username: users.username,
      })
      .from(guestbookEntries)
      .innerJoin(blogs, eq(blogs.id, guestbookEntries.blogId))
      .innerJoin(users, eq(users.id, guestbookEntries.authorId))
      .leftJoin(profiles, eq(profiles.userId, guestbookEntries.authorId))
      .orderBy(desc(guestbookEntries.createdAt), desc(guestbookEntries.id))
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE),
    db.select({ total: count() }).from(guestbookEntries),
  ]);
  return { items, total };
}

/** 관리자 글 삭제 (어느 블로그의 글이든) + 관리 기록. 지운 글의 블로그 ID, 없으면 null */
export async function adminRemovePost(adminId: string, postId: number): Promise<number | null> {
  return db.transaction(async (tx) => {
    const [deleted] = await tx.delete(posts).where(eq(posts.id, postId)).returning({ blogId: posts.blogId, title: posts.title });
    if (!deleted) return null;
    await writeAudit(tx, adminId, "delete_post", { type: "post", id: postId, label: deleted.title });
    return deleted.blogId;
  });
}

/**
 * 선택 삭제: 기존 삭제와 같은 방식으로 지운다 (글은 행 삭제, 댓글·답글은 자리만 남기는 삭제, 방명록은 행 삭제).
 * 이미 지워졌거나 없는 항목은 건너뛴다. 지운 것마다 관리 기록 한 줄. 지운 수를 돌려준다.
 */
export async function deleteContent(admin: Member, refs: ContentRef[]): Promise<number> {
  let removed = 0;
  for (const ref of refs) {
    if (ref.kind === "post") {
      if ((await adminRemovePost(admin.userId, ref.id)) !== null) removed++;
    } else if (ref.kind === "comment") {
      const [row] = await db
        .select({ content: comments.content })
        .from(comments)
        .where(and(eq(comments.id, ref.id), isNull(comments.deletedAt)));
      if (row && (await removeComment(admin, ref.id)) !== null) {
        await writeAudit(db, admin.userId, "delete_comment", { type: "comment", id: ref.id, label: snippet(row.content) });
        removed++;
      }
    } else if (ref.kind === "reply") {
      const [row] = await db
        .select({ content: replies.content })
        .from(replies)
        .where(and(eq(replies.id, ref.id), isNull(replies.deletedAt)));
      if (row && (await removeReply(admin, ref.id)) !== null) {
        await writeAudit(db, admin.userId, "delete_reply", { type: "reply", id: ref.id, label: snippet(row.content) });
        removed++;
      }
    } else {
      const [row] = await db.select({ content: guestbookEntries.content }).from(guestbookEntries).where(eq(guestbookEntries.id, ref.id));
      if (row && (await removeEntry(admin, ref.id))) {
        await writeAudit(db, admin.userId, "delete_guestbook", { type: "guestbook", id: ref.id, label: snippet(row.content) });
        removed++;
      }
    }
  }
  return removed;
}

/** 블라인드: 글을 비공개로 돌리고 작성자가 다시 공개하지 못하게 잠근다 */
export async function blindPost(adminId: string, postId: number, reason: string): Promise<AdminResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(posts)
      .set({ isPublic: false, blindedAt: sql`now()`, blindReason: reason, updatedAt: sql`${posts.updatedAt}` })
      .where(eq(posts.id, postId))
      .returning({ title: posts.title });
    if (!row) return { ok: false, error: ADMIN_ERRORS.postNotFound };
    await writeAudit(tx, adminId, "blind_post", { type: "post", id: postId, label: row.title }, reason);
    return { ok: true, message: "글을 가렸어요. 작성자만 볼 수 있어요" };
  });
}

/** 블라인드 해제: 잠금만 푼다. 글은 비공개로 남고 작성자가 다시 공개할 수 있다 */
export async function unblindPost(adminId: string, postId: number): Promise<AdminResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(posts)
      .set({ blindedAt: null, blindReason: null, updatedAt: sql`${posts.updatedAt}` })
      .where(and(eq(posts.id, postId), isNotNull(posts.blindedAt)))
      .returning({ title: posts.title });
    if (!row) return { ok: false, error: ADMIN_ERRORS.postNotFound };
    await writeAudit(tx, adminId, "unblind_post", { type: "post", id: postId, label: row.title });
    return { ok: true, message: "블라인드를 풀었어요. 작성자가 다시 공개할 수 있어요" };
  });
}

// ── 사이트 설정 (ADM-04·05) ────────────────────────────────

export const NOTICE_KEY = "notice";

async function readSetting(key: string) {
  const [row] = await db.select({ value: siteSettings.value, updatedAt: siteSettings.updatedAt }).from(siteSettings).where(eq(siteSettings.key, key));
  return row ?? null;
}

async function writeSetting(tx: Tx, key: string, value: string) {
  await tx
    .insert(siteSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: sql`now()` } });
}

/** 저장된 공지 띠 (꺼 둔 것도). 없으면 null */
export async function getNoticeSetting(): Promise<(SiteNotice & { updatedAt: Date }) | null> {
  const row = await readSetting(NOTICE_KEY);
  const notice = decodeNotice(row?.value);
  return row && notice ? { ...notice, updatedAt: row.updatedAt } : null;
}

/** 모든 화면 맨 위에 보일 공지 띠: 켜져 있을 때만. 읽지 못해도 화면은 열린다 (한 요청에 한 번) */
export const getActiveNotice = cache(async () => {
  try {
    const notice = await getNoticeSetting();
    return notice?.enabled ? notice : null;
  } catch (error) {
    console.error("공지 띠 읽기 실패", error);
    return null;
  }
});

export async function setNotice(adminId: string, notice: SiteNotice): Promise<AdminResult> {
  await db.transaction(async (tx) => {
    await writeSetting(tx, NOTICE_KEY, JSON.stringify(notice));
    await writeAudit(
      tx,
      adminId,
      "notice",
      { type: "site", id: NOTICE_KEY, label: notice.enabled ? "켬" : "끔" },
      `${notice.text}${notice.link ? ` (${notice.link})` : ""}`,
    );
  });
  return { ok: true, message: notice.enabled ? "공지 띠를 저장했어요" : "공지 띠를 저장했어요 (꺼 둠)" };
}

export async function saveBannedWords(adminId: string, words: string[]): Promise<AdminResult> {
  const before = await readBannedWords();
  await db.transaction(async (tx) => {
    await writeSetting(tx, BANNED_KEY, words.join("\n"));
    const added = words.filter((w) => !before.includes(w));
    const removed = before.filter((w) => !words.includes(w));
    const detail = [added.length ? `추가: ${added.join(", ")}` : "", removed.length ? `삭제: ${removed.join(", ")}` : ""].filter(Boolean).join(" / ");
    await writeAudit(tx, adminId, "banned_words", { type: "site", id: BANNED_KEY, label: `${words.length}개` }, detail || null);
  });
  clearBannedWordsCache();
  return { ok: true, message: `금지어 ${words.length}개를 저장했어요` };
}

/** 문의 답변 기록 (SUP-03 처리 + ADM-06) */
export async function auditFeedback(adminId: string, feedbackId: number, status: string, reply: string | null) {
  const [row] = await db.select({ title: feedback.title }).from(feedback).where(eq(feedback.id, feedbackId));
  await writeAudit(
    db,
    adminId,
    "feedback",
    { type: "feedback", id: feedbackId, label: row?.title ?? `#${feedbackId}` },
    `상태: ${status}${reply ? ` · 답변: ${snippet(reply, 200)}` : ""}`,
  );
}
