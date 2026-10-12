import Link from "next/link";

type Item = { id: number; title: string } | null;

/** 글 상세 아래 이전 글(더 오래된 글)·다음 글(더 새 글). 제목만, 긴 제목은 …로 (POST-05). 아래 선은 바로 붙는 글 바닥(footer)의 위 선이 맡는다 */
export function AdjacentPosts({ slug, older, newer }: { slug: string; older: Item; newer: Item }) {
  if (!older && !newer) return null;
  const rows = [
    { label: "이전 글", item: older },
    { label: "다음 글", item: newer },
  ].filter((r): r is { label: string; item: { id: number; title: string } } => r.item !== null);
  return (
    <nav aria-label="이전 글·다음 글" className="mt-8 divide-y divide-line border-t border-line">
      {rows.map(({ label, item }) => (
        <Link key={label} href={`/@${slug}/${item.id}`} className="flex min-h-11 items-center gap-3 px-1 py-2 hover:bg-ink/5" data-adjacent={label}>
          <span className="shrink-0 text-sm text-ink-soft">{label}</span>
          <span className="min-w-0 truncate font-medium">{item.title}</span>
        </Link>
      ))}
    </nav>
  );
}
