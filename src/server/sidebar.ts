import "server-only";
import { and, asc, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { comments, posts, postTags, profiles, replies, tags } from "@/db/schema";

export const SIDEBAR_POSTS = 5;
export const SIDEBAR_COMMENTS = 5;
export const SIDEBAR_TAGS = 30;

export type SidebarComment = { kind: "comment" | "reply"; id: number; postId: number; content: string; nickname: string | null };

/**
 * 블로그 홈 옆 칸 (BLOG-09): 최근 글·인기 글·최근 댓글·태그.
 * 주인이 아니면 비공개 글, 그 글의 댓글, 비공개 글에만 붙은 태그는 없다.
 */
export async function getBlogSidebar(blogId: number, viewerIsOwner: boolean) {
  const visible = and(eq(posts.blogId, blogId), viewerIsOwner ? undefined : eq(posts.isPublic, true));
  const postLink = { id: posts.id, title: posts.title };
  const uses = count(postTags.postId);

  const [recent, popular, recentComments, blogTags] = await Promise.all([
    db.select(postLink).from(posts).where(visible).orderBy(desc(posts.createdAt), desc(posts.id)).limit(SIDEBAR_POSTS),
    db
      .select({ ...postLink, viewCount: posts.viewCount })
      .from(posts)
      .where(and(visible, gte(posts.viewCount, 1)))
      .orderBy(desc(posts.viewCount), desc(posts.createdAt), desc(posts.id))
      .limit(SIDEBAR_POSTS),
    // 댓글과 답글을 합쳐 최근 5개 (지운 것 제외)
    db.execute<{ kind: "comment" | "reply"; id: number; post_id: number; content: string; nickname: string | null }>(sql`
      select * from (
        select 'comment' as kind, c.id, c.post_id, c.content, p.nickname, c.created_at
        from ${comments} c
        join ${posts} on ${posts.id} = c.post_id
        left join ${profiles} p on p.user_id = c.author_id
        where ${visible} and c.deleted_at is null
        union all
        select 'reply' as kind, r.id, c.post_id, r.content, p.nickname, r.created_at
        from ${replies} r
        join ${comments} c on c.id = r.comment_id
        join ${posts} on ${posts.id} = c.post_id
        left join ${profiles} p on p.user_id = r.author_id
        where ${visible} and r.deleted_at is null
      ) t
      order by created_at desc, id desc
      limit ${SIDEBAR_COMMENTS}
    `),
    db
      .select({ name: tags.name, count: uses })
      .from(tags)
      .innerJoin(postTags, eq(postTags.tagId, tags.id))
      .innerJoin(posts, and(eq(posts.id, postTags.postId), visible))
      .groupBy(tags.id)
      .orderBy(desc(uses), asc(tags.name))
      .limit(SIDEBAR_TAGS),
  ]);

  return {
    recent,
    popular,
    comments: recentComments.map(
      (r): SidebarComment => ({ kind: r.kind, id: r.id, postId: r.post_id, content: r.content, nickname: r.nickname }),
    ),
    tags: blogTags,
  };
}
