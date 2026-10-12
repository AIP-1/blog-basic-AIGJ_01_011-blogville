import Link from "next/link";
import { NEIGHBOR_LIST_LIMIT, type Neighbor } from "@/server/follows";
import { UnfollowButton } from "./UnfollowButton";

/**
 * 이웃 새 글 위 `👫 내 이웃 N` (SOC-04 열린 질문의 제안). 접어 두고 누르면 펼친다.
 * 줄마다 블로그 이름(누르면 그 블로그) · 닉네임 · 공개 글 수 · `서로 이웃` · [✓ 이웃](확인 뒤 취소).
 */
export function NeighborList({ items, total }: { items: Neighbor[]; total: number }) {
  return (
    <details className="group mt-4 rounded-xl border border-line bg-surface">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 font-semibold [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="text-ink-soft transition-transform group-open:rotate-90">
          ▸
        </span>
        👫 내 이웃 {total}
      </summary>
      {items.length === 0 ? (
        <p className="border-t border-line px-4 py-3 text-ink-soft">아직 이웃이 없어요. 블로그에서 [+ 이웃 추가]를 눌러 보세요.</p>
      ) : (
        <ul aria-label="내 이웃" className="divide-y divide-line border-t border-line">
          {items.map((n) => (
            <li key={n.userId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/@${n.slug}`}
                  id={`neighbor-${n.slug}`}
                  className="-ml-1 inline-flex min-h-11 max-w-full items-center px-1 font-semibold hover:underline"
                >
                  {n.blogTitle}
                </Link>
                <p className="text-sm text-ink-soft">
                  {n.nickname} · 글 {n.postCount}
                  {n.mutual && " "}
                  {n.mutual && <span className="ml-1 rounded-full bg-[#e1f5fe] px-2 py-0.5 text-xs font-semibold text-[#01579b]">서로 이웃</span>}
                </p>
              </div>
              <UnfollowButton followeeId={n.userId} describedBy={`neighbor-${n.slug}`} />
            </li>
          ))}
        </ul>
      )}
      {total > items.length && (
        <p className="border-t border-line px-4 py-2 text-sm text-ink-soft">최근 글 순으로 {NEIGHBOR_LIST_LIMIT}명까지 보여요.</p>
      )}
    </details>
  );
}
