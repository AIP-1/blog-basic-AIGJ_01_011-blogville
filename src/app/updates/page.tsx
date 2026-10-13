import type { Metadata } from "next";
import { RELEASES_REPO } from "@/lib/releases";
import { formatDate } from "@/lib/text";
import { listReleases } from "@/server/releases";

export const metadata: Metadata = { title: "업데이트 소식 | Blogville", description: "Blogville에 새로 생긴 것들 (릴리스 노트)" };

// 업데이트 소식: 배포할 때 GitHub에 올라가는 릴리스 노트를 그대로 보여 준다 (최신이 위)
export default async function UpdatesPage() {
  const releases = await listReleases();
  const all = `https://github.com/${RELEASES_REPO}/releases`;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="space-y-1 rounded-2xl border border-line bg-surface p-5">
        <h1 className="text-2xl font-extrabold">🆕 업데이트 소식</h1>
        <p className="text-sm text-ink-soft">Blogville에 새로 생긴 것들을 버전마다 모았어요.</p>
      </header>
      {releases === null ? (
        <p className="rounded-2xl border border-line bg-surface p-5 text-sm" data-updates-error>
          업데이트 소식을 불러오지 못했어요. 잠시 뒤 다시 열거나{" "}
          <a href={all} target="_blank" rel="noopener noreferrer" className="underline">
            GitHub 릴리스
          </a>
          에서 보세요.
        </p>
      ) : releases.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-ink-soft">아직 업데이트 소식이 없어요</p>
      ) : (
        releases.map((r, i) => (
          <article key={r.tag} className="min-w-0 space-y-3 rounded-2xl border border-line bg-surface p-5" data-release={r.tag} aria-labelledby={`release-${i}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`release-${i}`} className="text-xl font-bold">
                {r.name}
                {i === 0 && <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 align-middle text-xs font-bold text-accent">최신</span>}
              </h2>
              <time dateTime={r.publishedAt.toISOString()} className="text-sm text-ink-soft">
                {formatDate(r.publishedAt)}
              </time>
            </div>
            <div className="prose-post release-body min-w-0" dangerouslySetInnerHTML={{ __html: r.html }} />
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-ink-soft underline">
              GitHub에서 보기 ({r.tag})
            </a>
          </article>
        ))
      )}
    </div>
  );
}
