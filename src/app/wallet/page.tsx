import Link from "next/link";
import type { Metadata } from "next";
import { Pagination } from "@/components/blog/Pagination";
import { GamePageShell } from "@/components/game/GamePageShell";
import { houseArt } from "@/lib/art/town";
import { formatDateTime } from "@/lib/time";
import { formatNumber, LEDGER_PAGE_SIZE, REASON_LABEL } from "@/lib/game";
import { houseStage } from "@/lib/house";
import { parsePage } from "@/lib/ids";
import { currentRoof, ROOF_HEX } from "@/lib/roof";
import { getMyBlog, requireMember } from "@/server/dal";
import { getWallet, listLedger } from "@/server/points";

export const metadata: Metadata = { title: "경험치·코인 내역 | Blogville" };

const signed = (n: number) => (n > 0 ? `+${formatNumber(n)}` : `−${formatNumber(-n)}`);

// 경험치·코인 내역 (GAME-07): 위에 레벨·누적 경험치·코인, 아래 원장 최신순 20개씩. 간판은 광장에 선 내 집
export default async function WalletPage({ searchParams }: PageProps<"/wallet">) {
  const member = await requireMember();
  const page = parsePage((await searchParams).page);
  const [wallet, { items, total }, blog] = await Promise.all([getWallet(member.userId), listLedger(member.userId, page), getMyBlog(member.userId)]);
  const { progress } = wallet;

  return (
    <GamePageShell
      room="wallet"
      art={houseArt(houseStage(progress.level), ROOF_HEX[currentRoof(blog.id, blog.roofColor)])}
      description={<>받은 경험치와 코인, 쓴 코인을 최신순으로 적어 둬요. 기록 {formatNumber(total)}개</>}
    >
      <div className="space-y-6">
        <dl className="grid grid-cols-3 gap-3 text-center" aria-label="요약">
          <div className="px-tile min-w-0 p-3">
            <dt className="text-sm text-ink-soft">레벨</dt>
            <dd className="truncate text-xl font-extrabold" data-summary="level">
              Lv.{progress.level}
            </dd>
          </div>
          <div className="px-tile min-w-0 p-3">
            <dt className="text-sm text-ink-soft">누적 경험치</dt>
            <dd className="px-exp truncate text-xl font-extrabold" data-summary="exp">
              ✨ {formatNumber(wallet.exp)}
            </dd>
          </div>
          <div className="px-tile min-w-0 p-3">
            <dt className="text-sm text-ink-soft">코인</dt>
            <dd className="truncate text-xl font-extrabold" data-summary="coin">
              🪙 {formatNumber(wallet.coin)}
            </dd>
          </div>
        </dl>

        {/* 다음 레벨까지 (GAME-02): 8px 마디 도트 막대 */}
        <div className="px-tile p-4">
          <p className="mb-3 flex justify-between text-sm">
            <span className="font-semibold">다음 레벨까지</span>
            <span data-progress>{progress.isMax ? "최고 레벨" : `${formatNumber(progress.current)} / ${formatNumber(progress.needed)} EXP`}</span>
          </p>
          <span
            className="px-bar mx-0.5"
            role="progressbar"
            aria-label="다음 레벨까지 경험치"
            aria-valuemin={0}
            aria-valuemax={progress.isMax ? 1 : progress.needed}
            aria-valuenow={progress.isMax ? 1 : progress.current}
          >
            <span style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
          </span>
        </div>

        {items.length === 0 ? (
          <p className="px-tile p-6 text-center text-ink-soft">아직 기록이 없어요</p>
        ) : (
          <ol className="px-tile divide-y-2 divide-line" aria-label="기록">
            {items.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3" data-ledger={row.reason}>
                <span className="min-w-0">
                  <span className="font-semibold">{REASON_LABEL[row.reason] ?? row.reason}</span>
                  <time className="ml-2 text-sm text-ink-soft" dateTime={row.createdAt.toISOString()}>
                    {formatDateTime(row.createdAt)}
                  </time>
                </span>
                <span className="flex shrink-0 gap-3 font-semibold">
                  {row.expDelta !== 0 && <span className="px-exp">✨ {signed(row.expDelta)}</span>}
                  {row.coinDelta !== 0 && <span className={row.coinDelta > 0 ? "px-gain" : "px-loss"}>🪙 {signed(row.coinDelta)}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
        <Pagination basePath="/wallet" query={{}} page={page} totalPages={Math.ceil(total / LEDGER_PAGE_SIZE)} />
        <p className="text-sm text-ink-soft">
          모은 코인은{" "}
          <Link href="/shop" className="font-semibold text-accent underline">
            🏪 마을 상점
          </Link>
          에서 쓸 수 있어요.
        </p>
      </div>
    </GamePageShell>
  );
}
