import type { Metadata } from "next";
import Link from "next/link";
import { Pagination } from "@/components/blog/Pagination";
import { parsePage } from "@/lib/ids";
import { hasNewRelease, RELEASES_PAGE_SIZE, RELEASES_REPO, releaseSummary, releaseTitle } from "@/lib/releases";
import { Time } from "@/components/common/Time";
import { listReleases } from "@/server/releases";

export const metadata: Metadata = { title: "업데이트 소식 | Blogville", description: "Blogville에 새로 생긴 것들 (릴리스 노트)" };

// 업데이트 소식: GitHub 릴리스 노트를 버전·날짜·한 줄 요약의 목록으로 보여 주고, 누르면 버전별 화면(/updates/v1.6.0)
export default async function UpdatesPage({ searchParams }: PageProps<"/updates">) {
  const releases = await listReleases();
  const all = `https://github.com/${RELEASES_REPO}/releases`;
  const total = releases?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / RELEASES_PAGE_SIZE));
  const page = Math.min(parsePage((await searchParams).page), totalPages);
  const shown = releases?.slice((page - 1) * RELEASES_PAGE_SIZE, page * RELEASES_PAGE_SIZE) ?? [];
  const latestIsNew = hasNewRelease(releases);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="space-y-1 rounded-2xl border border-line bg-surface p-5">
        <h1 className="text-2xl font-extrabold">🆕 업데이트 소식</h1>
        <p className="text-sm text-ink-soft">Blogville에 새로 생긴 것들을 버전마다 모았어요{total > 0 ? ` · ${total}개` : ""}.</p>
      </header>
      {releases === null ? (
        <p className="rounded-2xl border border-line bg-surface p-5 text-sm" data-updates-error>
          업데이트 소식을 불러오지 못했어요. 잠시 뒤 다시 열거나{" "}
          <a href={all} target="_blank" rel="noopener noreferrer" className="underline">
            GitHub 릴리스
          </a>
          에서 보세요.
        </p>
      ) : total === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-ink-soft">아직 업데이트 소식이 없어요</p>
      ) : (
        <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface" aria-label="릴리스 목록">
          {shown.map((r) => {
            const isLatest = r.tag === releases[0].tag;
            return (
              <li key={r.tag} data-release={r.tag}>
                <Link href={`/updates/${r.tag}`} className="block min-w-0 space-y-1 px-5 py-4 hover:bg-bg">
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-bold">{releaseTitle(r.name)}</span>
                    {isLatest && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent" data-release-latest>
                        {latestIsNew ? "NEW" : "최신"}
                      </span>
                    )}
                  </span>
                  <span className="block text-sm text-ink-soft">
                    <Time date={r.publishedAt} />
                  </span>
                  {releaseSummary(r.html) && <span className="block text-sm">{releaseSummary(r.html)}</span>}
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      <Pagination basePath="/updates" query={{}} page={page} totalPages={totalPages} />
    </div>
  );
}
