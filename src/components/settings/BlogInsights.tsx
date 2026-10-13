import Link from "next/link";
import { sourceLabel } from "@/lib/referrer";

type Referrers = { rows: { source: string; count: number }[]; total: number };
type Popular = { id: number; title: string; viewCount: number }[];

/** 블로그 관리의 유입 경로 (최근 30일, 글을 그날 처음 본 조회 기준) */
export function ReferrerList({ stats }: { stats: Referrers }) {
  if (stats.total === 0) return <p className="text-ink-soft">아직 기록이 없어요. 다른 사람이 글을 읽으면 어디서 왔는지 여기에 모여요.</p>;
  return (
    <ul className="space-y-2" data-referrers>
      {stats.rows.map((r) => {
        const percent = Math.round((r.count / stats.total) * 100);
        return (
          <li key={r.source}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-semibold">{sourceLabel(r.source)}</span>
              <span className="shrink-0 text-ink-soft">
                {r.count.toLocaleString("ko-KR")}회 · {percent}%
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(percent, 2)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** 블로그 관리의 인기 글 (공개 글 조회수 순) */
export function PopularPosts({ slug, posts }: { slug: string; posts: Popular }) {
  if (posts.length === 0) return <p className="text-ink-soft">아직 읽힌 공개 글이 없어요.</p>;
  return (
    <ol className="divide-y divide-line" data-popular-posts>
      {posts.map((p, n) => (
        <li key={p.id}>
          <Link href={`/@${slug}/${p.id}`} className="flex min-h-11 items-center gap-3 px-1 hover:bg-ink/5">
            <span className="w-6 shrink-0 text-right font-bold text-accent">{n + 1}</span>
            <span className="min-w-0 flex-1 truncate">{p.title}</span>
            <span className="shrink-0 text-sm text-ink-soft">👀 {p.viewCount.toLocaleString("ko-KR")}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
