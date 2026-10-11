import Link from "next/link";
import type { Post } from "@/db/schema";
import { excerpt, formatDate } from "@/lib/text";
import { CategoryBadge } from "../post/CategoryBadge";

type Props = { slug: string; post: Post; categoryName: string | null; subcategoryName: string | null };

export function PostCard({ slug, post, categoryName, subcategoryName }: Props) {
  return (
    <article>
      <Link href={`/@${slug}/${post.id}`} className="block rounded-xl border border-line bg-surface p-4 hover:border-accent">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge categoryName={categoryName} subcategoryName={subcategoryName} />
          {!post.isPublic && <span className="text-sm font-semibold text-ink-soft">🔒 비공개</span>}
        </div>
        <h2 className="mt-2 text-lg font-bold">{post.title}</h2>
        <p className="mt-1 line-clamp-2 text-ink-soft">{excerpt(post.contentText)}</p>
        <p className="mt-2 text-sm text-ink-soft">{formatDate(post.createdAt)}</p>
      </Link>
    </article>
  );
}
