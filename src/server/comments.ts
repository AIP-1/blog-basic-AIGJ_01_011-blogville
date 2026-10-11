import "server-only";
import { and, asc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { blogs, comments, posts, profiles, replies } from "@/db/schema";
import { COMMENT_ERRORS } from "@/lib/comment-rules";
import type { Member } from "./dal";

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
  canDelete: boolean;
};
export type CommentThreadItem = CommentLine & { canReply: boolean; replies: CommentLine[] };

/**
 * 글 상세의 댓글 영역. 권한은 서버가 계산하고, 작성자 회원 ID는 화면으로 넘기지 않는다.
 * 닉네임은 쓸 때가 아니라 지금 프로필 기준이다.
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
    x: { id: number; authorId: string | null; content: string; deletedAt: Date | null; createdAt: Date },
    a: { nickname: string | null; authorSlug: string | null },
  ): CommentLine => ({
    id: x.id,
    nickname: a.nickname,
    authorSlug: a.authorSlug,
    createdAt: x.createdAt,
    content: x.deletedAt ? "" : x.content,
    deleted: x.deletedAt !== null,
    canDelete: canDelete(x.authorId, x.deletedAt !== null),
  });

  let count = 0;
  const items: CommentThreadItem[] = rows.map(({ c, ...a }) => {
    if (!c.deletedAt) count++;
    const own = replyRows.filter(({ r }) => r.commentId === c.id);
    count += own.filter(({ r }) => !r.deletedAt).length;
    return {
      ...line(c, a),
      canReply: viewer !== null && !c.deletedAt,
      replies: own.map(({ r, ...ra }) => line(r, ra)),
    };
  });
  return { items, count };
}

/** 공개 글이거나 내 글이면 잠그고 true. 댓글을 쓰는 동안 글이 지워지지 않게 한다. */
/** 공개 글이거나 내 글이면 글 행을 잠그고 true (댓글·공감) */
export async function lockVisiblePost(tx: Tx, userId: string, postId: number) {
  const [row] = await tx
    .select({ id: posts.id })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .where(and(eq(posts.id, postId), or(eq(posts.isPublic, true), eq(blogs.ownerId, userId))))
    .for("key share", { of: posts });
  return row !== undefined;
}

type Result = { ok: true } | { ok: false; error: string };

export async function createComment(userId: string, postId: number, content: string): Promise<Result> {
  return db.transaction(async (tx) => {
    if (!(await lockVisiblePost(tx, userId, postId))) return { ok: false, error: COMMENT_ERRORS.postNotFound };
    await tx.insert(comments).values({ postId, authorId: userId, content });
    // 보상(GAME-05)·알림(GAME-08)은 게임 기능이 생기면 이 트랜잭션에 붙인다
    return { ok: true };
  });
}

export async function createReply(userId: string, postId: number, commentId: number, content: string): Promise<Result> {
  return db.transaction(async (tx) => {
    if (!(await lockVisiblePost(tx, userId, postId))) return { ok: false, error: COMMENT_ERRORS.postNotFound };
    // 원댓글을 잠가 답글 저장과 원댓글 삭제가 겹치지 않게 한다
    const [parent] = await tx
      .select({ postId: comments.postId, deletedAt: comments.deletedAt })
      .from(comments)
      .where(eq(comments.id, commentId))
      .for("share");
    if (!parent || parent.postId !== postId) return { ok: false, error: COMMENT_ERRORS.parentNotFound };
    if (parent.deletedAt) return { ok: false, error: COMMENT_ERRORS.parentDeleted };
    await tx.insert(replies).values({ commentId, authorId: userId, content });
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
