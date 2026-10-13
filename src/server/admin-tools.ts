import "server-only";
import { and, count, desc, eq, gt, ilike, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { adminLogs, blogs, comments, posts, profiles, replies, sessions, siteSettings, users } from "@/db/schema";
import { ADMIN_ERRORS, ADMIN_PAGE_SIZE, lastDaysKST, likePattern, type AdminResult, type SuspendDays } from "@/lib/admin-rules";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** 관리 기록 한 줄 */
export async function writeAdminLog(tx: Tx | typeof db, adminId: string, action: string, target: string, detail: string | null = null) {
  await tx.insert(adminLogs).values({ adminId, action, target: target.slice(0, 200), detail: detail?.slice(0, 500) ?? null });
}

// ── 대시보드 ───────────────────────────────────────────────

/** 최근 7일(한국 날짜) 가입·글·댓글 수 */
export async function getWeeklyActivity() {
  const days = lastDaysKST(7);
  const since = sql`(${days[0]}::date at time zone 'Asia/Seoul')`;
  const day = (col: SQL) => sql<string>`to_char(${col} at time zone 'Asia/Seoul', 'YYYY-MM-DD')`;
  const [signups, newPosts, newComments] = await Promise.all([
    db.execute<{ d: string; n: number }>(sql`select ${day(sql`created_at`)} as d, count(*)::int as n from ${users} where created_at >= ${since} group by 1`),
    db.execute<{ d: string; n: number }>(sql`select ${day(sql`created_at`)} as d, count(*)::int as n from ${posts} where created_at >= ${since} group by 1`),
    db.execute<{ d: string; n: number }>(sql`
      select d, sum(n)::int as n from (
        select ${day(sql`created_at`)} as d, count(*) as n from ${comments} where created_at >= ${since} and deleted_at is null group by 1
        union all
        select ${day(sql`created_at`)} as d, count(*) as n from ${replies} where created_at >= ${since} and deleted_at is null group by 1
      ) t group by d`),
  ]);
  const pick = (rows: { d: string; n: number }[]) => new Map(rows.map((r) => [r.d, Number(r.n)]));
  const [s, p, c] = [pick(signups), pick(newPosts), pick(newComments)];
  return days.map((d) => ({ day: d, signups: s.get(d) ?? 0, posts: p.get(d) ?? 0, comments: c.get(d) ?? 0 }));
}

/** 정지 중인 회원 수 · 블라인드 글 수 */
export async function getModerationCounts() {
  const [[s], [b]] = await Promise.all([
    db.select({ n: count() }).from(users).where(gt(users.suspendedUntil, sql`now()`)),
    db.select({ n: count() }).from(posts).where(isNotNull(posts.blindedAt)),
  ]);
  return { suspended: s.n, blinded: b.n };
}

// ── 회원 ───────────────────────────────────────────────────

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
        lastSeen: sql<Date | null>`(select max(s.updated_at) from ${sessions} s where s.user_id = ${users.id})`,
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

/** 회원 정지: 로그인한 세션을 모두 끊고, 기간 동안 로그인을 막는다. 관리자·나 자신은 거절 */
export async function suspendMember(adminId: string, userId: string, days: SuspendDays, reason: string): Promise<AdminResult> {
  if (userId === adminId) return { ok: false, error: ADMIN_ERRORS.self };
  return db.transaction(async (tx) => {
    const target = await lockTarget(tx, userId);
    if (!target) return { ok: false, error: ADMIN_ERRORS.notFound };
    if (target.role === "admin") return { ok: false, error: ADMIN_ERRORS.adminTarget };
    const until = days === 0 ? sql`'infinity'::timestamptz` : sql`now() + make_interval(days => ${days})`;
    await tx.update(users).set({ suspendedUntil: until, suspendReason: reason }).where(eq(users.id, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await writeAdminLog(tx, adminId, "suspend", target.username, `${days === 0 ? "영구" : `${days}일`} · ${reason}`);
    return { ok: true, message: `${target.username} 님을 정지했어요` };
  });
}

export async function unsuspendMember(adminId: string, userId: string): Promise<AdminResult> {
  return db.transaction(async (tx) => {
    const target = await lockTarget(tx, userId);
    if (!target) return { ok: false, error: ADMIN_ERRORS.notFound };
    await tx.update(users).set({ suspendedUntil: null, suspendReason: null }).where(eq(users.id, userId));
    await writeAdminLog(tx, adminId, "unsuspend", target.username);
    return { ok: true, message: `${target.username} 님의 정지를 풀었어요` };
  });
}

/** 관리자 권한 주기·빼기. 나 자신의 권한은 뺄 수 없고, 관리자는 한 명 이상 남는다 */
export async function setMemberRole(adminId: string, userId: string, role: "admin" | "user"): Promise<AdminResult> {
  if (role === "user" && userId === adminId) return { ok: false, error: ADMIN_ERRORS.self };
  return db.transaction(async (tx) => {
    // 관리자 수를 세는 동안 다른 관리자가 동시에 빼지 못하게 관리자 행을 모두 잠근다
    await tx.select({ id: users.id }).from(users).where(eq(users.role, "admin")).for("update");
    const target = await lockTarget(tx, userId);
    if (!target) return { ok: false, error: ADMIN_ERRORS.notFound };
    if (target.role === role) return { ok: true, message: "이미 그렇게 되어 있어요" };
    if (role === "user") {
      const [{ n }] = await tx.select({ n: count() }).from(users).where(and(eq(users.role, "admin"), ne(users.id, userId)));
      if (n === 0) return { ok: false, error: ADMIN_ERRORS.lastAdmin };
    }
    // 정지된 회원을 관리자로 만들면 정지도 함께 푼다 (관리자는 정지 상태가 없다)
    await tx
      .update(users)
      .set(role === "admin" ? { role, suspendedUntil: null, suspendReason: null } : { role })
      .where(eq(users.id, userId));
    await writeAdminLog(tx, adminId, role === "admin" ? "grant_admin" : "revoke_admin", target.username);
    return { ok: true, message: role === "admin" ? `${target.username} 님을 관리자로 만들었어요` : `${target.username} 님의 관리자 권한을 뺐어요` };
  });
}

/** 로그인할 때 확인: 정지 중이면 기한과 사유 */
export async function getSuspension(userId: string) {
  const [row] = await db
    .select({ until: users.suspendedUntil, reason: users.suspendReason })
    .from(users)
    .where(and(eq(users.id, userId), gt(users.suspendedUntil, sql`now()`)));
  return row?.until ? { until: row.until, reason: row.reason } : null;
}

// ── 글 ─────────────────────────────────────────────────────

export type PostFilter = "all" | "public" | "private" | "blinded";

export async function listAllPosts(opts: { query: string; filter: PostFilter; page: number }) {
  const conds: (SQL | undefined)[] = [];
  if (opts.query) conds.push(or(ilike(posts.title, likePattern(opts.query)), ilike(profiles.nickname, likePattern(opts.query)), ilike(blogs.slug, likePattern(opts.query))));
  if (opts.filter === "public") conds.push(eq(posts.isPublic, true));
  if (opts.filter === "private") conds.push(and(eq(posts.isPublic, false), isNull(posts.blindedAt)));
  if (opts.filter === "blinded") conds.push(isNotNull(posts.blindedAt));
  const where = and(...conds);
  const base = () => db.select().from(posts).innerJoin(blogs, eq(blogs.id, posts.blogId)).innerJoin(profiles, eq(profiles.userId, blogs.ownerId));
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: posts.id,
        title: posts.title,
        isPublic: posts.isPublic,
        blindedAt: posts.blindedAt,
        blindReason: posts.blindReason,
        viewCount: posts.viewCount,
        createdAt: posts.createdAt,
        slug: blogs.slug,
        nickname: profiles.nickname,
      })
      .from(posts)
      .innerJoin(blogs, eq(blogs.id, posts.blogId))
      .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
      .where(where)
      .orderBy(desc(posts.createdAt), desc(posts.id))
      .limit(ADMIN_PAGE_SIZE)
      .offset((opts.page - 1) * ADMIN_PAGE_SIZE),
    db.select({ total: count() }).from(base().as("x")).where(sql`true`).then(() =>
      db.select({ total: count() }).from(posts).innerJoin(blogs, eq(blogs.id, posts.blogId)).innerJoin(profiles, eq(profiles.userId, blogs.ownerId)).where(where),
    ),
  ]);
  return { items: rows, total };
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
    await writeAdminLog(tx, adminId, "blind_post", row.title, reason);
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
    await writeAdminLog(tx, adminId, "unblind_post", row.title);
    return { ok: true, message: "블라인드를 풀었어요. 작성자가 다시 공개할 수 있어요" };
  });
}

// ── 댓글 ───────────────────────────────────────────────────

export type AdminComment = {
  kind: "comment" | "reply";
  id: number;
  postId: number;
  postTitle: string;
  blogSlug: string;
  content: string;
  nickname: string | null;
  username: string | null;
  isSecret: boolean;
  createdAt: Date;
};

/** 사이트 전체의 지우지 않은 댓글·답글, 최신순. 검색어는 내용·닉네임·아이디 */
export async function listAllComments(opts: { query: string; page: number }): Promise<{ items: AdminComment[]; total: number }> {
  const all = sql`
    select 'comment' as kind, c.id, c.post_id, c.author_id, c.content, c.is_secret, c.created_at
    from ${comments} c where c.deleted_at is null
    union all
    select 'reply' as kind, r.id, c.post_id, r.author_id, r.content, r.is_secret, r.created_at
    from ${replies} r join ${comments} c on c.id = r.comment_id where r.deleted_at is null
  `;
  const filter = opts.query
    ? sql`where t.content ilike ${likePattern(opts.query)} or pr.nickname ilike ${likePattern(opts.query)} or u.username ilike ${likePattern(opts.query)}`
    : sql``;
  const from = sql`from (${all}) t
    join ${posts} p on p.id = t.post_id
    join ${blogs} pb on pb.id = p.blog_id
    left join ${profiles} pr on pr.user_id = t.author_id
    left join ${users} u on u.id = t.author_id
    ${filter}`;
  const [rows, [{ total }]] = await Promise.all([
    db.execute<{
      kind: "comment" | "reply";
      id: number;
      post_id: number;
      post_title: string;
      blog_slug: string;
      content: string;
      nickname: string | null;
      username: string | null;
      is_secret: boolean;
      created_at: string | Date;
    }>(sql`
      select t.kind, t.id, t.post_id, p.title as post_title, pb.slug as blog_slug, t.content, t.is_secret, pr.nickname, u.username, t.created_at
      ${from}
      order by t.created_at desc, t.kind desc, t.id desc
      limit ${ADMIN_PAGE_SIZE} offset ${(opts.page - 1) * ADMIN_PAGE_SIZE}
    `),
    db.execute<{ total: number }>(sql`select count(*)::int as total ${from}`),
  ]);
  return {
    total: Number(total),
    items: rows.map((r) => ({
      kind: r.kind,
      id: r.id,
      postId: r.post_id,
      postTitle: r.post_title,
      blogSlug: r.blog_slug,
      content: r.content,
      nickname: r.nickname,
      username: r.username,
      isSecret: r.is_secret,
      createdAt: new Date(r.created_at),
    })),
  };
}

// ── 관리 기록 · 사이트 설정 ─────────────────────────────────

export async function listAdminLogs(page: number) {
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ id: adminLogs.id, action: adminLogs.action, target: adminLogs.target, detail: adminLogs.detail, createdAt: adminLogs.createdAt, admin: users.username })
      .from(adminLogs)
      .leftJoin(users, eq(users.id, adminLogs.adminId))
      .orderBy(desc(adminLogs.createdAt), desc(adminLogs.id))
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE),
    db.select({ total: count() }).from(adminLogs),
  ]);
  return { items: rows, total };
}

/** 모든 화면 맨 위 공지 띠. 없으면 빈 문자열 */
export async function getBanner(): Promise<string> {
  try {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, "banner"));
    return row?.value ?? "";
  } catch {
    // 공지 띠를 못 읽어도 화면은 열린다
    return "";
  }
}

export async function setBanner(adminId: string, text: string): Promise<AdminResult> {
  await db.transaction(async (tx) => {
    await tx
      .insert(siteSettings)
      .values({ key: "banner", value: text })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: text, updatedAt: sql`now()` } });
    await writeAdminLog(tx, adminId, "banner", text ? "공지 띠" : "공지 띠 끄기", text || null);
  });
  return { ok: true, message: text ? "공지 띠를 바꿨어요" : "공지 띠를 껐어요" };
}
