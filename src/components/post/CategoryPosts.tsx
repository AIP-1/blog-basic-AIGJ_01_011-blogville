import Link from "next/link";
import { Time } from "@/components/common/Time";

type Item = { id: number; title: string; createdAt: Date };

/** 글 상세 맨 아래: "'카테고리' 카테고리의 다른 글" 최신 5개와 [더 보기] (티스토리처럼) */
export function CategoryPosts({ slug, categoryName, href, items }: { slug: string; categoryName: string; href: string; items: Item[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={`${categoryName} 카테고리의 다른 글`} className="mt-10 rounded-xl border border-line p-4" data-category-posts>
      <div className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate font-bold">
          🗂 &lsquo;{categoryName}&rsquo; 카테고리의 다른 글
        </h2>
        <Link href={href} className="flex min-h-11 shrink-0 items-center px-1 text-sm text-ink-soft hover:text-ink">
          더 보기
        </Link>
      </div>
      <ul className="divide-y divide-line">
        {items.map((p) => (
          <li key={p.id}>
            <Link href={`/@${slug}/${p.id}`} className="flex min-h-11 items-center justify-between gap-3 px-1 py-2 hover:bg-ink/5">
              <span className="min-w-0 truncate">{p.title}</span>
              <Time date={p.createdAt} className="shrink-0 text-sm text-ink-soft" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
