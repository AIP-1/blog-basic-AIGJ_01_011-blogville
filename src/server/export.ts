import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { Zip, ZipDeflate, ZipPassThrough } from "fflate";
import { db } from "@/db";
import { attachments, blogs, categories, comments, guestbookEntries, posts, postTags, profiles, replies, series, subcategories, tags } from "@/db/schema";
import {
  attachmentPath,
  EXPORT_INTERVAL_MS,
  exportWaitMs,
  type ExportPost,
  postBaseName,
  readmeText,
  renderIndexHtml,
  renderPostHtml,
  renderPostMarkdown,
  visibilityLabel,
} from "@/lib/export";
import { openFile } from "./storage";

// 내 블로그 내보내기 (백업 .zip). 블로그 주인만 (라우트 핸들러가 세션으로 확인한다)

// 회원마다 마지막 내보내기 시각. 서버 메모리라 서버를 다시 켜면 비고, 서버가 여러 대면 대마다 따로 센다.
// 무거운 일을 자주 못 하게 막는 용도라 그 정도는 괜찮다 (새 표를 만들지 않는다).
const globalForExport = globalThis as unknown as { lastExportAt?: Map<string, number> };
const lastExportAt = (globalForExport.lastExportAt ??= new Map<string, number>());

/** 지금 내보낼 수 있으면 시각을 적고 0, 아니면 남은 기다림(ms) */
export function claimExport(userId: string, now = Date.now()): number {
  const wait = exportWaitMs(lastExportAt.get(userId), now);
  if (wait > 0) return wait;
  for (const [id, at] of lastExportAt) if (at + EXPORT_INTERVAL_MS <= now) lastExportAt.delete(id);
  lastExportAt.set(userId, now);
  return 0;
}

type Blog = typeof blogs.$inferSelect;

/** 압축 파일에 넣을 것 한 개: 글자(바로 넣음) 또는 저장소의 첨부(스트림으로 읽음) */
type Entry = { name: string; mtime: Date } & ({ text: string } | { fileKey: string });

const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

/** 블로그의 모든 것을 모아 압축 파일에 넣을 순서대로 */
async function collect(blog: Blog, now: Date): Promise<Entry[]> {
  const [cats, subs, seriesRows, postRows, owner] = await Promise.all([
    db.select().from(categories).where(eq(categories.blogId, blog.id)).orderBy(asc(categories.position)),
    db
      .select({ id: subcategories.id, categoryId: subcategories.categoryId, name: subcategories.name, position: subcategories.position })
      .from(subcategories)
      .innerJoin(categories, eq(categories.id, subcategories.categoryId))
      .where(eq(categories.blogId, blog.id))
      .orderBy(asc(subcategories.position)),
    db.select().from(series).where(eq(series.blogId, blog.id)).orderBy(asc(series.createdAt)),
    db.select().from(posts).where(eq(posts.blogId, blog.id)).orderBy(asc(posts.createdAt), asc(posts.id)),
    db.query.profiles.findFirst({ where: eq(profiles.userId, blog.ownerId) }),
  ]);
  const postIds = postRows.map((p) => p.id);
  const [tagRows, files, commentRows, guestRows] = await Promise.all([
    postIds.length
      ? db.select({ postId: postTags.postId, name: tags.name }).from(postTags).innerJoin(tags, eq(tags.id, postTags.tagId)).where(inArray(postTags.postId, postIds)).orderBy(asc(tags.name))
      : [],
    postIds.length
      ? db
          .select({ key: attachments.key, kind: attachments.kind, name: attachments.name, mime: attachments.mime, size: attachments.size, postId: attachments.postId, createdAt: attachments.createdAt })
          .from(attachments)
          .where(inArray(attachments.postId, postIds))
          .orderBy(asc(attachments.createdAt))
      : [],
    postIds.length
      ? db
          .select({
            id: comments.id,
            postId: comments.postId,
            authorId: comments.authorId,
            nickname: profiles.nickname,
            content: comments.content,
            isSecret: comments.isSecret,
            editedAt: comments.editedAt,
            deletedAt: comments.deletedAt,
            createdAt: comments.createdAt,
          })
          .from(comments)
          .leftJoin(profiles, eq(profiles.userId, comments.authorId))
          .where(inArray(comments.postId, postIds))
          .orderBy(asc(comments.createdAt), asc(comments.id))
      : [],
    db
      .select({
        authorId: guestbookEntries.authorId,
        nickname: profiles.nickname,
        content: guestbookEntries.content,
        isSecret: guestbookEntries.isSecret,
        editedAt: guestbookEntries.editedAt,
        reply: guestbookEntries.reply,
        repliedAt: guestbookEntries.repliedAt,
        createdAt: guestbookEntries.createdAt,
      })
      .from(guestbookEntries)
      .leftJoin(profiles, eq(profiles.userId, guestbookEntries.authorId))
      .where(eq(guestbookEntries.blogId, blog.id))
      .orderBy(asc(guestbookEntries.createdAt), asc(guestbookEntries.id)),
  ]);
  const commentIds = commentRows.map((c) => c.id);
  const replyRows = commentIds.length
    ? await db
        .select({
          commentId: replies.commentId,
          authorId: replies.authorId,
          nickname: profiles.nickname,
          content: replies.content,
          isSecret: replies.isSecret,
          editedAt: replies.editedAt,
          deletedAt: replies.deletedAt,
          createdAt: replies.createdAt,
        })
        .from(replies)
        .leftJoin(profiles, eq(profiles.userId, replies.authorId))
        .where(inArray(replies.commentId, commentIds))
        .orderBy(asc(replies.createdAt), asc(replies.id))
    : [];

  // 남의 아이디는 넣지 않는다: 닉네임과 "주인이 쓴 것인지"만
  const who = (authorId: string | null, nickname: string | null) => ({
    author: authorId === null ? "(탈퇴한 회원)" : (nickname ?? "(알 수 없음)"),
    byOwner: authorId === blog.ownerId,
  });

  const paths = new Map(files.map((f) => [f.key, attachmentPath(f)]));
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const subName = new Map(subs.map((s) => [s.id, s.name]));
  const seriesName = new Map(seriesRows.map((s) => [s.id, s.title]));
  const tagsOf = new Map<number, string[]>();
  for (const t of tagRows) tagsOf.set(t.postId, [...(tagsOf.get(t.postId) ?? []), t.name]);

  const exported = postRows.map((p) => {
    const category = p.categoryId ? [catName.get(p.categoryId), p.subcategoryId ? subName.get(p.subcategoryId) : undefined].filter(Boolean).join(" > ") : null;
    const post: ExportPost = {
      id: p.id,
      title: p.title,
      contentHtml: p.contentHtml,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      category: category || null,
      series: p.seriesId ? (seriesName.get(p.seriesId) ?? null) : null,
      tags: tagsOf.get(p.id) ?? [],
      visibility: visibilityLabel(p),
    };
    return { row: p, post, base: postBaseName(p.id, p.title) };
  });

  const blogJson = {
    format: "blogville-export",
    version: 1,
    exportedAt: now.toISOString(),
    blog: { slug: blog.slug, title: blog.title, intro: blog.intro, owner: owner?.nickname ?? "", createdAt: blog.createdAt.toISOString(), url: `/@${blog.slug}` },
    categories: cats.map((c) => ({
      id: c.id,
      name: c.name,
      subcategories: subs.filter((s) => s.categoryId === c.id).map((s) => ({ id: s.id, name: s.name })),
    })),
    series: seriesRows.map((s) => ({ id: s.id, title: s.title, createdAt: s.createdAt.toISOString() })),
    posts: exported.map(({ row, post, base }) => ({
      id: row.id,
      title: row.title,
      html: `${base}.html`,
      markdown: `${base}.md`,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      categoryId: row.categoryId,
      subcategoryId: row.subcategoryId,
      category: post.category,
      seriesId: row.seriesId,
      series: post.series,
      tags: post.tags,
      isPublic: row.isPublic,
      scheduledAt: row.publishAt?.toISOString() ?? null,
      blinded: row.blindedAt !== null,
      visibility: post.visibility,
      viewCount: row.viewCount,
    })),
    attachments: files.map((f) => ({ path: paths.get(f.key), name: f.name, kind: f.kind, mime: f.mime, size: f.size, postId: f.postId })),
  };

  const commentsJson = exported
    .map(({ row }) => ({
      postId: row.id,
      postTitle: row.title,
      comments: commentRows
        .filter((c) => c.postId === row.id)
        .map((c) => ({
          ...who(c.authorId, c.nickname),
          content: c.content,
          secret: c.isSecret,
          deleted: c.deletedAt !== null,
          createdAt: c.createdAt.toISOString(),
          editedAt: c.editedAt?.toISOString() ?? null,
          replies: replyRows
            .filter((r) => r.commentId === c.id && r.deletedAt === null)
            .map((r) => ({ ...who(r.authorId, r.nickname), content: r.content, secret: r.isSecret, createdAt: r.createdAt.toISOString(), editedAt: r.editedAt?.toISOString() ?? null })),
        }))
        // 지운 댓글은 답글이 남아 있을 때만 자리로 남긴다
        .filter((c) => !c.deleted || c.replies.length > 0),
    }))
    .filter((p) => p.comments.length > 0);

  const guestbookJson = guestRows.map((g) => ({
    ...who(g.authorId, g.nickname),
    content: g.content,
    secret: g.isSecret,
    createdAt: g.createdAt.toISOString(),
    editedAt: g.editedAt?.toISOString() ?? null,
    reply: g.reply,
    repliedAt: g.repliedAt?.toISOString() ?? null,
  }));

  const counts = {
    posts: postRows.length,
    files: files.length,
    comments: commentsJson.reduce((n, p) => n + p.comments.length + p.comments.reduce((m, c) => m + c.replies.length, 0), 0),
    guestbook: guestRows.length,
  };
  const entries: Entry[] = [
    { name: "README.txt", mtime: now, text: readmeText(blog, counts, now) },
    {
      name: "index.html",
      mtime: now,
      text: renderIndexHtml(
        blog,
        [...exported].reverse().map(({ row, post, base }) => ({ title: row.title, file: `${base}.html`, date: row.createdAt, visibility: post.visibility })),
      ),
    },
    { name: "blog.json", mtime: now, text: json(blogJson) },
    { name: "comments.json", mtime: now, text: json(commentsJson) },
    { name: "guestbook.json", mtime: now, text: json(guestbookJson) },
  ];
  for (const { row, post, base } of exported) {
    entries.push({ name: `${base}.html`, mtime: row.updatedAt, text: renderPostHtml(post, blog.title, paths) });
    entries.push({ name: `${base}.md`, mtime: row.updatedAt, text: renderPostMarkdown(post, paths) });
  }
  for (const f of files) entries.push({ name: paths.get(f.key)!, mtime: f.createdAt, fileKey: f.key });
  return entries;
}

/**
 * 압축 파일을 조각씩 만든다. 받는 쪽이 읽을 때마다 다음 조각을 만들어(pull) 첨부를 한꺼번에 메모리에 올리지 않는다.
 * 글자 파일은 압축하고, 첨부(사진·이미 압축된 형식이 많다)는 그대로 담는다.
 */
async function* zipChunks(entries: Entry[]): AsyncGenerator<Uint8Array> {
  const out: Uint8Array[] = [];
  let failure: Error | null = null;
  const zip = new Zip((err, chunk) => {
    if (err) failure = err;
    else out.push(chunk);
  });
  const drain = function* () {
    if (failure) throw failure;
    while (out.length) yield out.shift()!;
  };
  // ZIP 날짜는 1980년부터
  const mtimeOf = (d: Date) => (d.getFullYear() < 1980 ? new Date(1980, 0, 1) : d);

  for (const e of entries) {
    if ("text" in e) {
      const f = new ZipDeflate(e.name, { level: 6 });
      f.mtime = mtimeOf(e.mtime);
      zip.add(f);
      f.push(new TextEncoder().encode(e.text), true);
      yield* drain();
      continue;
    }
    const file = await openFile(e.fileKey);
    if (!file) continue; // 저장소에서 사라진 첨부는 건너뛴다 (blog.json에는 남는다)
    const f = new ZipPassThrough(e.name);
    f.mtime = mtimeOf(e.mtime);
    zip.add(f);
    const reader = file.stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      f.push(value as Uint8Array);
      yield* drain();
    }
    f.push(new Uint8Array(0), true);
    yield* drain();
  }
  zip.end();
  yield* drain();
}

/** 블로그 백업 .zip 스트림 */
export async function exportBlogStream(blog: Blog, now = new Date()): Promise<ReadableStream<Uint8Array>> {
  const entries = await collect(blog, now);
  const chunks = zipChunks(entries);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await chunks.next();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (err) {
        controller.error(err);
      }
    },
    async cancel() {
      await chunks.return(undefined);
    },
  });
}
