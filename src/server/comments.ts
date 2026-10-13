import "server-only";
import { and, asc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { blogs, comments, posts, profiles, replies, users } from "@/db/schema";
import { COMMENT_ERRORS, isCommentHidden, isReplyHidden } from "@/lib/comment-rules";
import type { Member } from "./dal";
import { notifyActivity } from "./notifications";
import { grantReward } from "./points";

/** 글 목록 카드·상세의 `💬 N`: 삭제되지 않은 댓글 + 답글 (SOC-01·02) */
export function commentCountSql(postId: SQL | typeof posts.id): SQL<number> {
  return sql<number>`(
    (select count(*) from ${comments} c where c.post_id = ${postId} and c.deleted_at is null)
    + (select count(*) from ${replies} r join ${comments} c on c.id = r.comment_id where c.post_id = ${postId} and r.deleted_at is null)
  )::int`;
}

export type CommentLine = {
  id: number;
  nickname: string | null;
  authorSlug: string | null;
  createdAt: Date;
  content: string;
  deleted: boolean;
  /** 작성자가 탈퇴해 자리만 남은 댓글: 닉네임·시각도 보이지 않는다 (AUTH-06) */
  withdrawn: boolean;
  /** 비밀 댓글·답글 (볼 수 있는 사람에게는 🔒 표시, specs/055-comment-edit-secret) */
  secret: boolean;
  /** 볼 수 없는 비밀 댓글: 내용은 서버에서 비워 보내고 `🔒 비밀 댓글이에요`만 보인다 */
  hidden: boolean;
  /** 작성자가 고친 시각. 있으면 시각 옆에 `(수정됨)` */
  editedAt: Date | null;
  canDelete: boolean;
  /** 고칠 수 있는 사람은 작성자 본인뿐 (블로그 주인·관리자도 남의 댓글은 못 고친다) */
  canEdit: boolean;
};
export type CommentThreadItem = CommentLine & { canReply: boolean; replies: CommentLine[] };

/**
 * 글 상세의 댓글 영역. 권한은 서버가 계산하고, 작성자 회원 ID는 화면으로 넘기지 않는다.
 * 닉네임은 쓸 때가 아니라 지금 프로필 기준이다.
 * 볼 수 없는 비밀 댓글·답글은 여기서 내용을 비운다: 브라우저로 내용이 가지 않는다 (specs/055-comment-edit-secret).
 */
export async function getCommentThread(postId: number, blogOwnerId: string, viewer: Member | null) {
  const canDelete = (authorId: string | null, deleted: boolean) =>
    !deleted && viewer !== null && (viewer.role === "admin" || viewer.userId === authorId || viewer.userId === blogOwnerId);
  const author = { nickname: profiles.nickname, authorSlug: blogs.slug };

  const rows = await db
    .select({ c: comments, ...author })
    .from(comments)
    .leftJoin(profiles, eq(profiles.userId, comments.authorId))
    .leftJoin(blogs, eq(blogs.ownerId, comments.authorId))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt), asc(comments.id));
  const replyRows = rows.length
    ? await db
        .select({ r: replies, ...author })
        .from(replies)
        .leftJoin(profiles, eq(profiles.userId, replies.authorId))
        .leftJoin(blogs, eq(blogs.ownerId, replies.authorId))
        .where(
          inArray(
            replies.commentId,
            rows.map((r) => r.c.id),
          ),
        )
        .orderBy(asc(replies.createdAt), asc(replies.id))
    : [];

  const line = (
    x: { id: number; authorId: string | null; content: string; isSecret: boolean; editedAt: Date | null; deletedAt: Date | null; createdAt: Date },
    a: { nickname: string | null; authorSlug: string | null },
    hidden: boolean,
  ): CommentLine => {
    const deleted = x.deletedAt !== null;
    return {
      id: x.id,
      nickname: a.nickname,
      authorSlug: a.authorSlug,
      createdAt: x.createdAt,
      content: deleted || hidden ? "" : x.content,
      deleted,
      withdrawn: x.authorId === null,
      secret: x.isSecret,
      hidden: !deleted && hidden,
      editedAt: deleted || hidden ? null : x.editedAt,
      canDelete: canDelete(x.authorId, deleted),
      canEdit: !deleted && viewer !== null && x.authorId === viewer.userId,
    };
  };

  let count = 0;
  const items: CommentThreadItem[] = rows.map(({ c, ...a }) => {
    if (!c.deletedAt) count++;
    const own = replyRows.filter(({ r }) => r.commentId === c.id);
    count += own.filter(({ r }) => !r.deletedAt).length;
    const hidden = isCommentHidden(viewer, blogOwnerId, c);
    return {
      ...line(c, a, hidden),
      // 볼 수 없는 비밀 댓글에는 답글을 달 수 없다
      canReply: viewer !== null && !c.deletedAt && !hidden,
      replies: own.map(({ r, ...ra }) => line(r, ra, isReplyHidden(viewer, blogOwnerId, r, c))),
    };
  });
  return { items, count };
}

/**
 * 회원 행을 FOR KEY SHARE로 잠근다. 없으면(탈퇴) false.
 * 알림을 받을 회원의 행은 글·원댓글보다 먼저 잠근다. 탈퇴(deleteMember)가 회원 행 → 글·댓글 순서로 잠그므로
 * 거꾸로 잠그면 알림 외래 키 확인과 엇갈려 교착 상태가 된다 (GAME-08).
 */
async function lockMemberRow(tx: Tx, userId: string): Promise<boolean> {
  const rows = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("key share");
  return rows.length > 0;
}

/**
 * 공개 글이거나 내 글이면 글 행을 잠그고 글 주인 ID, 아니면 null (댓글·공감).
 * 댓글을 쓰는 동안 글이 지워지지 않게 한다. 주인 ID는 알림을 받을 사람이라 주인 회원 행을 먼저 잠근다 (GAME-08).
 */
export async function lockVisiblePost(tx: Tx, userId: string, postId: number): Promise<string | null> {
  const [owner] = await tx.select({ ownerId: blogs.ownerId }).from(posts).innerJoin(blogs, eq(blogs.id, posts.blogId)).where(eq(posts.id, postId));
  if (!owner) return null;
  if (owner.ownerId !== userId && !(await lockMemberRow(tx, owner.ownerId))) return null;
  const [row] = await tx
    .select({ ownerId: blogs.ownerId })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .where(and(eq(posts.id, postId), or(eq(posts.isPublic, true), eq(blogs.ownerId, userId))))
    .for("key share", { of: posts });
  return row?.ownerId ?? null;
}

type Result = { ok: true } | { ok: false; error: string };

export async function createComment(userId: string, postId: number, content: string, isSecret = false): Promise<Result> {
  return db.transaction(async (tx) => {
    const ownerId = await lockVisiblePost(tx, userId, postId);
    if (ownerId === null) return { ok: false, error: COMMENT_ERRORS.postNotFound };
    const [row] = await tx.insert(comments).values({ postId, authorId: userId, content, isSecret }).returning({ id: comments.id });
    // 글 주인에게 댓글 알림 (GAME-08)
    await notifyActivity(tx, { kind: "comment", recipientId: ownerId, actorId: userId, postId });
    // 남의 글에 쓴 댓글은 보상, 답글과 합쳐 하루 10번까지 (GAME-05)
    if (ownerId !== userId) await grantReward(tx, userId, "comment", `comment:${row.id}`);
    return { ok: true };
  });
}

export async function createReply(
  member: Pick<Member, "userId" | "role">,
  postId: number,
  commentId: number,
  content: string,
  isSecret = false,
): Promise<Result> {
  const userId = member.userId;
  return db.transaction(async (tx) => {
    const ownerId = await lockVisiblePost(tx, userId, postId);
    if (ownerId === null) return { ok: false, error: COMMENT_ERRORS.postNotFound };
    // 답글 알림을 받을 원댓글 작성자의 회원 행을 원댓글보다 먼저 잠근다. 그새 탈퇴했으면 아래에서 작성자가 비어 알림이 없다
    const [author] = await tx.select({ authorId: comments.authorId }).from(comments).where(eq(comments.id, commentId));
    if (author?.authorId && author.authorId !== userId) await lockMemberRow(tx, author.authorId);
    // 원댓글을 잠가 답글 저장과 원댓글 삭제가 겹치지 않게 한다
    const [parent] = await tx
      .select({ postId: comments.postId, authorId: comments.authorId, isSecret: comments.isSecret, deletedAt: comments.deletedAt })
      .from(comments)
      .where(eq(comments.id, commentId))
      .for("share");
    if (!parent || parent.postId !== postId) return { ok: false, error: COMMENT_ERRORS.parentNotFound };
    // 볼 수 없는 비밀 댓글에는 답글을 달 수 없다 (화면에도 [답글]이 없다)
    if (isCommentHidden(member, ownerId, parent)) return { ok: false, error: COMMENT_ERRORS.parentNotFound };
    if (parent.deletedAt) return { ok: false, error: COMMENT_ERRORS.parentDeleted };
    const [row] = await tx.insert(replies).values({ commentId, authorId: userId, content, isSecret }).returning({ id: replies.id });
    // 원댓글 작성자에게 답글 알림 (글 주인에게는 없음, GAME-08)
    await notifyActivity(tx, { kind: "reply", recipientId: parent.authorId, actorId: userId, postId });
    // 남의 글에 쓴 답글도 댓글 보상 (댓글과 합쳐 하루 10번, GAME-05·SOC-02)
    if (ownerId !== userId) await grantReward(tx, userId, "comment", `reply:${row.id}`);
    return { ok: true };
  });
}

/** 지울 수 있는 사람: 관리자, 작성자, 그 글의 블로그 주인. 조건은 UPDATE 문에 넣는다. */
function mayDelete(member: Member, authorId: typeof comments.authorId | typeof replies.authorId, postId: SQL | typeof comments.postId) {
  if (member.role === "admin") return undefined;
  return or(
    eq(authorId, member.userId),
    sql`exists (select 1 from ${posts} p join ${blogs} b on b.id = p.blog_id where p.id = ${postId} and b.owner_id = ${member.userId})`,
  );
}

const erased = { deletedAt: sql`now()`, content: "" };

/** 이 회원에게 보이는 글(공개 글이거나 내 글)인지. UPDATE 문 조건에 넣는다 */
function postVisibleTo(userId: string, postId: SQL | typeof comments.postId) {
  return sql`exists (select 1 from ${posts} p join ${blogs} b on b.id = p.blog_id where p.id = ${postId} and (p.is_public or b.owner_id = ${userId}))`;
}

/**
 * 댓글 수정 (specs/055-comment-edit-secret): 작성자 본인이 지우지 않은 댓글만, 내용과 비밀 여부를 바꾼다.
 * 조건은 UPDATE 문에 넣어 남의 댓글·지운 댓글·볼 수 없는 글의 댓글은 바뀌지 않는다.
 * `edited_at`은 내용이 바뀔 때만 지금 시각으로 (비밀만 켜고 끄면 `(수정됨)`이 붙지 않는다).
 */
export async function editComment(userId: string, commentId: number, content: string, isSecret: boolean): Promise<Result> {
  const [row] = await db
    .update(comments)
    .set({ content, isSecret, editedAt: sql`case when ${comments.content} = ${content} then ${comments.editedAt} else now() end` })
    .where(and(eq(comments.id, commentId), eq(comments.authorId, userId), isNull(comments.deletedAt), postVisibleTo(userId, comments.postId)))
    .returning({ id: comments.id });
  return row ? { ok: true } : { ok: false, error: COMMENT_ERRORS.editNotFound };
}

export async function editReply(userId: string, replyId: number, content: string, isSecret: boolean): Promise<Result> {
  const parentPost = sql`(select c.post_id from ${comments} c where c.id = ${replies.commentId})`;
  const [row] = await db
    .update(replies)
    .set({ content, isSecret, editedAt: sql`case when ${replies.content} = ${content} then ${replies.editedAt} else now() end` })
    .where(and(eq(replies.id, replyId), eq(replies.authorId, userId), isNull(replies.deletedAt), postVisibleTo(userId, parentPost)))
    .returning({ id: replies.id });
  return row ? { ok: true } : { ok: false, error: COMMENT_ERRORS.editNotFound };
}

/** 자리를 남기고 지운다. 바뀐 행이 있으면 그 글 ID, 없으면 null (문구 없음) */
export async function removeComment(member: Member, commentId: number): Promise<number | null> {
  const [row] = await db
    .update(comments)
    .set(erased)
    .where(and(eq(comments.id, commentId), isNull(comments.deletedAt), mayDelete(member, comments.authorId, comments.postId)))
    .returning({ postId: comments.postId });
  return row?.postId ?? null;
}

export async function removeReply(member: Member, replyId: number): Promise<number | null> {
  const parentPost = sql`(select c.post_id from ${comments} c where c.id = ${replies.commentId})`;
  const [row] = await db
    .update(replies)
    .set(erased)
    .where(and(eq(replies.id, replyId), isNull(replies.deletedAt), mayDelete(member, replies.authorId, parentPost)))
    .returning({ commentId: replies.commentId });
  return row ? row.commentId : null;
}

export const MANAGE_COMMENTS_PAGE_SIZE = 20;

export type ManagedComment = {
  kind: "comment" | "reply";
  id: number;
  postId: number;
  postTitle: string;
  content: string;
  nickname: string | null;
  authorSlug: string | null;
  createdAt: Date;
  /** 비밀 댓글·답글. 블로그 주인은 내용을 그대로 본다 */
  secret: boolean;
};

/**
 * 댓글 관리 (SOC-01 열린 질문): 내 블로그 글(비공개 포함)에 달린, 지우지 않은 댓글과 답글을 최신순으로 한 쪽씩.
 * 작성자 회원 ID는 넘기지 않는다.
 */
export async function listBlogComments(blogId: number, page: number): Promise<{ items: ManagedComment[]; total: number }> {
  const all = sql`
    select 'comment' as kind, c.id, c.post_id, c.author_id, c.content, c.is_secret, c.created_at
    from ${comments} c join ${posts} p on p.id = c.post_id
    where p.blog_id = ${blogId} and c.deleted_at is null
    union all
    select 'reply' as kind, r.id, c.post_id, r.author_id, r.content, r.is_secret, r.created_at
    from ${replies} r join ${comments} c on c.id = r.comment_id join ${posts} p on p.id = c.post_id
    where p.blog_id = ${blogId} and r.deleted_at is null
  `;
  const [rows, [{ total }]] = await Promise.all([
    db.execute<{
      kind: "comment" | "reply";
      id: number;
      post_id: number;
      post_title: string;
      content: string;
      nickname: string | null;
      author_slug: string | null;
      is_secret: boolean;
      created_at: string | Date;
    }>(sql`
      select t.kind, t.id, t.post_id, p.title as post_title, t.content, t.is_secret, pr.nickname, b.slug as author_slug, t.created_at
      from (${all}) t
      join ${posts} p on p.id = t.post_id
      left join ${profiles} pr on pr.user_id = t.author_id
      left join ${blogs} b on b.owner_id = t.author_id
      order by t.created_at desc, t.kind desc, t.id desc
      limit ${MANAGE_COMMENTS_PAGE_SIZE} offset ${(page - 1) * MANAGE_COMMENTS_PAGE_SIZE}
    `),
    db.execute<{ total: number }>(sql`select count(*)::int as total from (${all}) t`),
  ]);
  return {
    total,
    items: rows.map((r) => ({
      kind: r.kind,
      id: r.id,
      postId: r.post_id,
      postTitle: r.post_title,
      content: r.content,
      nickname: r.nickname,
      authorSlug: r.author_slug,
      createdAt: new Date(r.created_at),
      secret: r.is_secret,
    })),
  };
}
