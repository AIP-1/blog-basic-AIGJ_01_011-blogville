import Link from "next/link";
import { tagHref } from "../post/TagList";

/** 🏷 인기 태그: 공개 글에 많이 달린 순, 30개 (POST-04) */
export function PopularTags({ tags }: { tags: { name: string; count: number }[] }) {
  return (
    <section aria-labelledby="popular-tags" className="rounded-xl border border-line bg-surface p-4">
      <h2 id="popular-tags" className="font-bold">
        🏷 인기 태그
      </h2>
      {tags.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">아직 태그가 없어요</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {tags.map((t) => (
            <li key={t.name}>
              <Link href={tagHref(t.name)} className="tag-chip">
                #{t.name} <span className="text-ink-soft">{t.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
