import "server-only";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogs, guestbookEntries, profiles } from "@/db/schema";
import { GUESTBOOK_ERRORS, GUESTBOOK_PAGE_SIZE, isEntryHidden } from "@/lib/guestbook-rules";
import { lockMemberRow } from "./comments";
import type { Member } from "./dal";
import { notifyGuestbook } from "./notifications";

// 방명록 (BLOG-10, specs/056-guestbook). 권한은 모두 서버가 로그인 세션으로 정한다: 폼에서는 ID만 받는다.

type Viewer = Pick<Member, "userId" | "role"> | null;
type Result = { ok: true } | { ok: false; error: string };

export type GuestbookReply = {
  /** 가려진 글의 답글이면 빈 글자 */
  content: string;
  repliedAt: Date;
  editedAt: Date | null;
};

export type GuestbookEntry = {
  id: number;
  nickname: string | null;
  authorSlug: string | null;
  createdAt: Date;
  /** 볼 수 없는 비밀 방명록이면 빈 글자 (서버에서 비운다) */
  content: string;
  secret: boolean;
  hidden: boolean;
  editedAt: Date | null;
  /** 주인의 답글. 가려진 글이면 답글도 내용 없이 `hidden`을 따른다 */
  reply: GuestbookReply | null;
  /** 작성자 본인만 */
  canEdit: boolean;
  /** 작성자, 블로그 주인, 관리자 */
  canDelete: boolean;
  /** 블로그 주인만 답글을 달고 고친다 */
  canReply: boolean;
  /** 답글 삭제: 블로그 주인, 관리자 */
  canDeleteReply: boolean;
  /** 🚨 신고: 볼 수 있는 남의 방명록이고 로그인한 회원일 때 (specs/059-report-bookmarks) */
  canReport: boolean;
};

/** 옆 칸·주인 도구의 `📖 방명록 N`: 비밀 방명록도 센다 */
export async function countGuestbook(blogId: number): Promise<number> {
  const [row] = await db.select({ n: count() }).from(guestbookEntries).where(eq(guestbookEntries.blogId, blogId));
  return row.n;
}

/**
 * 방명록 한 쪽 (최신순 10개). 작성자 회원 ID는 화면으로 넘기지 않는다.
 * 볼 수 없는 비밀 방명록은 여기서 내용과 답글 내용을 비운다: 브라우저로 내용이 가지 않는다.
 */
export async function getGuestbook(
  blog: { id: number; ownerId: string },
  viewer: Viewer,
  page: number,
): Promise<{ items: GuestbookEntry[]; total: number }> {
  const [rows, total] = await Promise.all([
    db
      .select({ e: guestbookEntries, nickname: profiles.nickname, authorSlug: blogs.slug })
      .from(guestbookEntries)
      .leftJoin(profiles, eq(profiles.userId, guestbookEntries.authorId))
      .leftJoin(blogs, eq(blogs.ownerId, guestbookEntries.authorId))
      .where(eq(guestbookEntries.blogId, blog.id))
      .orderBy(desc(guestbookEntries.createdAt), desc(guestbookEntries.id))
      .limit(GUESTBOOK_PAGE_SIZE)
      .offset((page - 1) * GUESTBOOK_PAGE_SIZE),
    countGuestbook(blog.id),
  ]);
  const isOwner = viewer !== null && viewer.userId === blog.ownerId;
  const isAdmin = viewer?.role === "admin";
  const items = rows.map(({ e, nickname, authorSlug }): GuestbookEntry => {
    const hidden = isEntryHidden(viewer, blog.ownerId, e);
    const isAuthor = viewer !== null && viewer.userId === e.authorId;
    return {
      id: e.id,
      nickname,
      authorSlug,
      createdAt: e.createdAt,
      content: hidden ? "" : e.content,
      secret: e.isSecret,
      hidden,
      editedAt: hidden ? null : e.editedAt,
      reply:
        e.reply !== null && e.repliedAt !== null
          ? { content: hidden ? "" : e.reply, repliedAt: e.repliedAt, editedAt: hidden ? null : e.replyEditedAt }
          : null,
      canEdit: isAuthor,
      canDelete: isAuthor || isOwner || isAdmin,
      canReply: isOwner,
      canDeleteReply: e.reply !== null && (isOwner || isAdmin),
      canReport: viewer !== null && !hidden && !isAuthor,
    };
  });
  return { items, total };
}

/** 한 회원이 1시간에 쓸 수 있는 방명록 글 수 (모든 블로그 합, plaza-upgrade-2: 광장 우체통 쪽지로 쓰는 길이 새로 생겨서) */
export const GUESTBOOK_HOURLY_LIMIT = 10;
export const GUESTBOOK_RATE_ERROR = "방명록은 1시간에 10개까지 쓸 수 있어요. 조금 뒤에 다시 남겨 주세요.";

/** 지난 1시간에 쓴 수로 거절 문구 (`GUESTBOOK_HOURLY_LIMIT`개를 이미 썼으면) */
export function guestbookRateRefusal(writtenLastHour: number): string | null {
  return writtenLastHour >= GUESTBOOK_HOURLY_LIMIT ? GUESTBOOK_RATE_ERROR : null;
}

/**
 * 방명록 글 쓰기. 블로그 주인에게 알림 (남이 쓴 글만).
 * 작성자별 잠금을 먼저 잡고 지난 1시간에 쓴 수를 센다(동시에 보내도 10개를 넘지 않는다, guestbook_entries_author_idx).
 * 그다음 알림을 받을 주인의 회원 행을 잠근다 (탈퇴와 엇갈리지 않게, 댓글과 같은 순서, GAME-08). 작성자 잠금은 이 함수만 잡아 순서가 꼬이지 않는다.
 */
export async function createEntry(userId: string, blogId: number, content: string, isSecret: boolean): Promise<Result> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"guestbook:" + userId}))`);
    const [recent] = await tx
      .select({ n: count() })
      .from(guestbookEntries)
      .where(and(eq(guestbookEntries.authorId, userId), gte(guestbookEntries.createdAt, sql`now() - interval '1 hour'`)));
    const limited = guestbookRateRefusal(recent.n);
    if (limited) return { ok: false, error: limited };
    const [blog] = await tx.select({ ownerId: blogs.ownerId }).from(blogs).where(eq(blogs.id, blogId));
    if (!blog) return { ok: false, error: GUESTBOOK_ERRORS.blogNotFound };
    if (blog.ownerId !== userId && !(await lockMemberRow(tx, blog.ownerId))) return { ok: false, error: GUESTBOOK_ERRORS.blogNotFound };
    const [locked] = await tx.select({ id: blogs.id }).from(blogs).where(eq(blogs.id, blogId)).for("key share");
    if (!locked) return { ok: false, error: GUESTBOOK_ERRORS.blogNotFound };
    const [row] = await tx.insert(guestbookEntries).values({ blogId, authorId: userId, content, isSecret }).returning({ id: guestbookEntries.id });
    await notifyGuestbook(tx, { kind: "guestbook", recipientId: blog.ownerId, actorId: userId, entryId: row.id });
    return { ok: true };
  });
}

/**
 * 방명록 글 수정: 작성자 본인만. 조건은 UPDATE 문에 넣어 남의 글은 바뀌지 않는다.
 * `edited_at`은 내용이 바뀔 때만 (비밀만 켜고 끄면 `(수정됨)`이 붙지 않는다).
 */
export async function editEntry(userId: string, entryId: number, content: string, isSecret: boolean): Promise<Result> {
  const [row] = await db
    .update(guestbookEntries)
    .set({ content, isSecret, editedAt: sql`case when ${guestbookEntries.content} = ${content} then ${guestbookEntries.editedAt} else now() end` })
    .where(and(eq(guestbookEntries.id, entryId), eq(guestbookEntries.authorId, userId)))
    .returning({ id: guestbookEntries.id });
  return row ? { ok: true } : { ok: false, error: GUESTBOOK_ERRORS.editNotFound };
}

/** 그 방명록 글의 블로그 주인이 이 회원인지. UPDATE·DELETE 문 조건에 넣는다 */
const ownsBlog = (userId: string) =>
  sql`exists (select 1 from ${blogs} b where b.id = ${guestbookEntries.blogId} and b.owner_id = ${userId})`;

/** 방명록 글 삭제 (답글도 함께): 작성자, 블로그 주인, 관리자. 지웠으면 true */
export async function removeEntry(member: Pick<Member, "userId" | "role">, entryId: number): Promise<boolean> {
  const may = member.role === "admin" ? undefined : sql`(${guestbookEntries.authorId} = ${member.userId} or ${ownsBlog(member.userId)})`;
  const rows = await db
    .delete(guestbookEntries)
    .where(and(eq(guestbookEntries.id, entryId), may))
    .returning({ id: guestbookEntries.id });
  return rows.length > 0;
}

/**
 * 주인 답글 달기·고치기: 그 블로그 주인만 (관리자도 남의 방명록에는 못 단다).
 * 처음 다는 답글이면 방명록 글 작성자에게 알림. 고칠 때 내용이 바뀌면 `reply_edited_at`.
 * 알림을 받을 작성자의 회원 행을 방명록 글보다 먼저 잠근다 (GAME-08).
 */
export async function setReply(userId: string, entryId: number, content: string): Promise<Result> {
  return db.transaction(async (tx) => {
    const notFound = { ok: false, error: GUESTBOOK_ERRORS.replyNotFound } as const;
    const [found] = await tx
      .select({ authorId: guestbookEntries.authorId, ownerId: blogs.ownerId })
      .from(guestbookEntries)
      .innerJoin(blogs, eq(blogs.id, guestbookEntries.blogId))
      .where(eq(guestbookEntries.id, entryId));
    if (!found || found.ownerId !== userId) return notFound;
    if (found.authorId !== userId && !(await lockMemberRow(tx, found.authorId))) return notFound;
    const [entry] = await tx
      .select({ reply: guestbookEntries.reply })
      .from(guestbookEntries)
      .where(and(eq(guestbookEntries.id, entryId), ownsBlog(userId)))
      .for("update");
    if (!entry) return notFound;
    await tx
      .update(guestbookEntries)
      .set({
        reply: content,
        repliedAt: sql`coalesce(${guestbookEntries.repliedAt}, now())`,
        replyEditedAt: sql`case when ${guestbookEntries.reply} is null or ${guestbookEntries.reply} = ${content} then ${guestbookEntries.replyEditedAt} else now() end`,
      })
      .where(eq(guestbookEntries.id, entryId));
    if (entry.reply === null) await notifyGuestbook(tx, { kind: "guestbook_reply", recipientId: found.authorId, actorId: userId, entryId });
    return { ok: true };
  });
}

/** 주인 답글 지우기: 블로그 주인, 관리자. 지웠으면 true */
export async function removeReply(member: Pick<Member, "userId" | "role">, entryId: number): Promise<boolean> {
  const rows = await db
    .update(guestbookEntries)
    .set({ reply: null, repliedAt: null, replyEditedAt: null })
    .where(and(eq(guestbookEntries.id, entryId), sql`${guestbookEntries.reply} is not null`, member.role === "admin" ? undefined : ownsBlog(member.userId)))
    .returning({ id: guestbookEntries.id });
  return rows.length > 0;
}
