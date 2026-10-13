import Link from "next/link";

export const tagHref = (name: string) => `/tags/${encodeURIComponent(name)}`;

/** 글 상세 본문 아래 `#태그` 배지 (이름순). 태그가 없으면 아무것도 그리지 않는다. */
export function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul aria-label="태그" className="mt-6 flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li key={tag}>
          <Link href={tagHref(tag)} className="tag-chip">
            #{tag}
          </Link>
        </li>
      ))}
    </ul>
  );
}
