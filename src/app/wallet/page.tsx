import type { Metadata } from "next";
import { Pagination } from "@/components/blog/Pagination";
import { formatDateTime } from "@/lib/comment-rules";
import { formatNumber, LEDGER_PAGE_SIZE, REASON_LABEL } from "@/lib/game";
import { parsePage } from "@/lib/ids";
import { requireMember } from "@/server/dal";
import { getWallet, listLedger } from "@/server/points";

export const metadata: Metadata = { title: "경험치·코인 내역 | Blogville" };

const signed = (n: number) => (n > 0 ? `+${formatNumber(n)}` : `−${formatNumber(-n)}`);

// 경험치·코인 내역 (GAME-07): 위에 레벨·누적 경험치·코인, 아래 원장 최신순 20개씩
export default async function WalletPage({ searchParams }: PageProps<"/wallet">) {
  const member = await requireMember();
  const page = parsePage((await searchParams).page);
  const [wallet, { items, total }] = await Promise.all([getWallet(member.userId), listLedger(member.userId, page)]);
  const { progress } = wallet;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-2xl font-extrabold">📒 경험치·코인 내역</h1>
        <p className="text-sm text-ink-soft">기록 {formatNumber(total)}개</p>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center" aria-label="요약">
        <div className="min-w-0 rounded-2xl border border-line bg-surface p-3">
          <dt className="text-sm text-ink-soft">레벨</dt>
          <dd className="truncate text-xl font-extrabold" data-summary="level">
            Lv.{progress.level}
          </dd>
        </div>
        <div className="min-w-0 rounded-2xl border border-line bg-surface p-3">
          <dt className="text-sm text-ink-soft">누적 경험치</dt>
          <dd className="truncate text-xl font-extrabold text-sky-600" data-summary="exp">
            ✨ {formatNumber(wallet.exp)}
          </dd>
        </div>
        <div className="min-w-0 rounded-2xl border border-line bg-surface p-3">
          <dt className="text-sm text-ink-soft">코인</dt>
          <dd className="truncate text-xl font-extrabold" data-summary="coin">
            🪙 {formatNumber(wallet.coin)}
          </dd>
        </div>
      </dl>

      {/* 다음 레벨까지 (GAME-02) */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="mb-2 flex justify-between text-sm">
          <span className="font-semibold">다음 레벨까지</span>
          <span data-progress>{progress.isMax ? "최고 레벨" : `${formatNumber(progress.current)} / ${formatNumber(progress.needed)} EXP`}</span>
        </p>
        <div
          className="h-3 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-label="다음 레벨까지 경험치"
          aria-valuemin={0}
          aria-valuemax={progress.isMax ? 1 : progress.needed}
          aria-valuenow={progress.isMax ? 1 : progress.current}
        >
          <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-6 text-center text-ink-soft">아직 기록이 없어요</p>
      ) : (
        <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface" aria-label="기록">
          {items.map((row) => (
            <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3" data-ledger={row.reason}>
              <span className="min-w-0">
                <span className="font-semibold">{REASON_LABEL[row.reason] ?? row.reason}</span>
                <time className="ml-2 text-sm text-ink-soft" dateTime={row.createdAt.toISOString()}>
                  {formatDateTime(row.createdAt)}
                </time>
              </span>
              <span className="flex shrink-0 gap-3 font-semibold">
                {row.expDelta !== 0 && <span className="text-sky-600">✨ {signed(row.expDelta)}</span>}
                {row.coinDelta !== 0 && <span className={row.coinDelta > 0 ? "text-green-700" : "text-red-600"}>🪙 {signed(row.coinDelta)}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      <Pagination basePath="/wallet" query={{}} page={page} totalPages={Math.ceil(total / LEDGER_PAGE_SIZE)} />
      <p className="text-sm text-ink-soft">코인은 상점이 열리면 쓸 수 있어요.</p>
    </div>
  );
}
