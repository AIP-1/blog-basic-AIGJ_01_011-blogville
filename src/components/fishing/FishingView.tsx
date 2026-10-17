"use client";

import Link from "next/link";
import { useActionState } from "react";
import { castLine, type CastState } from "@/app/fishing/actions";
import { PixelArtSvg } from "@/components/game/PixelArtSvg";
import { findArt } from "@/lib/art";
import { pixelRects } from "@/lib/art/characters";
import { catchArt, silhouetteArt } from "@/lib/art/fish";
import { pondArt, POND_FRAMES } from "@/lib/art/town";
import { findCatch, prizeLine, todayLine, type CatchCode } from "@/lib/fishing";
import { dexProgress, type DexCell } from "@/lib/fishing-book";
import type { FishingLog } from "@/server/fishing";

const dayFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", month: "long", day: "numeric", weekday: "short" });
const firstFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric" });

/** 도감 칸 그림의 칸 크기 (px). 모두 같은 배율이라 송사리는 작고 잉어는 크다 */
const DEX_CELL = 6;
/** 연못 그림의 칸 크기 (px): 간판 그림(3px)의 세 배 가까이 */
const POND_CELL = 8;

// 연못 물결 두 장을 번갈아 (움직임 줄이기면 첫 장에 멈춘다)
const POND_CSS = `
.fishing-pond-frame[data-frame="1"] { opacity: 0; }
@media (prefers-reduced-motion: no-preference) {
  .fishing-pond-frame { animation: fishing-pond 1.6s steps(1, end) infinite; }
  .fishing-pond-frame[data-frame="1"] { animation-delay: -0.8s; }
}
@keyframes fishing-pond { 0% { opacity: 1; } 50%, 100% { opacity: 0; } }
`;

/**
 * 낚시터 화면 (TOWN-14, plaza-upgrade-2 C3). 위는 도트 연못(물결 2장)과 잔교 위 내 캐릭터, 그 아래 낚싯대 던지기 또는 오늘 결과,
 * 그 아래 나무 액자 낚시 도감 여섯 칸(낚은 것은 이름·코인·처음 낚은 날·횟수, 못 낚은 것은 실루엣과 '???').
 * 던진 직후 서버가 화면을 다시 그리기 전에도 도감 칸이 바로 채워지게, 오늘 기록이 아직 없으면 방금 낚은 것을 한 번 더한다.
 */
export function FishingView({
  today,
  recent,
  book,
  date,
  layers,
}: {
  today: CatchCode | null;
  recent: FishingLog[];
  book: DexCell[];
  /** 오늘 (한국 날짜 `YYYY-MM-DD`) */
  date: string;
  /** 잔교 위에 세울 내 캐릭터 그림들 */
  layers: readonly string[];
}) {
  const [state, action, pending] = useActionState<CastState, FormData>(castLine, null);
  const caught = state?.ok ? state.catch : today;
  const fresh = state?.ok === true;
  // 서버가 아직 오늘 기록을 넘기지 않았으면(다시 그리기 전) 방금 낚은 것을 더한다
  const extra = fresh && today === null ? state.catch : null;
  const cells = book.map((c) => (c.code === extra ? { ...c, count: c.count + 1, first: c.first ?? date } : c));
  const log = extra && !recent.some((r) => r.date === date) ? [{ date, catch: extra }, ...recent] : recent;

  return (
    <div className="space-y-6">
      <section className="px-tile overflow-hidden p-4 text-center sm:p-6" data-tone="water" aria-label="연못" data-fishing={caught ?? "ready"}>
        <Pond layers={layers} />
        {caught === null ? (
          <>
            <p className="mt-3 font-semibold">연못에 낚싯대를 던져 볼까요?</p>
            {state && !state.ok && (
              <p role="alert" className="px-loss mt-2 font-semibold">
                {state.message}
              </p>
            )}
            <form action={action} className="mt-3">
              <button type="submit" className="px-btn px-btn--primary" disabled={pending}>
                {pending ? "기다리는 중…" : "🎣 낚싯대 던지기"}
              </button>
            </form>
          </>
        ) : (
          <div role="status" className="mt-3" data-catch={caught}>
            <div className="flex justify-center" aria-hidden="true">
              <span className="inline-flex h-16 items-end">
                <PixelArtSvg art={catchArt(caught)} cell={DEX_CELL + 2} />
              </span>
            </div>
            <p className="mt-2 text-xl font-extrabold">{fresh ? findCatch(caught)!.message : todayLine(caught)}</p>
            <p className="mt-1">{prizeLine(caught)}</p>
            {caught === "feed" && (
              <Link href="/farm" className="mt-1 inline-block underline">
                🐮 동물 농장으로
              </Link>
            )}
            <p className="mt-2 text-sm text-ink-soft">내일 다시 낚시할 수 있어요.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="fishing-catches" data-dex={cells.filter((c) => c.count > 0).length}>
        <h2 id="fishing-catches" className="flex flex-wrap items-baseline gap-x-2 font-bold">
          📖 낚시 도감 <span className="text-sm font-normal text-ink-soft" data-dex-progress>{dexProgress(cells)}</span>
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-3.5 sm:grid-cols-3">
          {cells.map((c) => (
            <DexFrame key={c.code} cell={c} justCaught={c.code === (fresh ? state.catch : null)} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="fishing-log">
        <h2 id="fishing-log" className="font-bold">
          📒 최근 낚시 기록
        </h2>
        {log.length === 0 ? (
          <p className="mt-2 text-ink-soft">아직 낚시 기록이 없어요.</p>
        ) : (
          <ul className="px-tile mt-3 divide-y-2 divide-line" data-fishing-log>
            {log.map((r) => {
              const c = findCatch(r.catch)!;
              return (
                <li key={r.date} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span>{dayFormat.format(new Date(`${r.date}T00:00:00Z`))}</span>
                  <span className="flex items-center gap-2">
                    <span className="inline-flex w-9 justify-center" aria-hidden="true">
                      <PixelArtSvg art={catchArt(r.catch)} cell={3} />
                    </span>
                    {c.name}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** 도트 연못(2장 물결)과 잔교 위 내 캐릭터 한 장 (SVG 하나라 좁은 화면에서는 통째로 줄어든다) */
function Pond({ layers }: { layers: readonly string[] }) {
  const frames = Array.from({ length: POND_FRAMES }, (_, f) => pondArt(f));
  const width = frames[0].rows[0].length;
  const height = frames[0].rows.length;
  const character = layers.flatMap((key) => {
    const art = findArt(key);
    return art ? [pixelRects(art)] : [];
  });
  return (
    <>
      <style href="fishing-pond" precedence="default">
        {POND_CSS}
      </style>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width * POND_CELL}
        height={height * POND_CELL}
        shapeRendering="crispEdges"
        className="mx-auto block h-auto max-w-full"
        aria-hidden="true"
        data-fishing-pond
      >
        {frames.map((art, f) => (
          <g key={f} className="fishing-pond-frame" data-frame={f}>
            <PondLayer art={art} />
          </g>
        ))}
        {/* 캐릭터 16칸을 연못 8칸 폭으로: 잔교(17~22칸) 위, 낚싯대 손잡이(23칸) 옆 */}
        {character.length > 0 && (
          <svg x={15.5} y={7} width={8} height={8} viewBox="0 0 16 16" data-fishing-me>
            {character.map((rects, i) => (
              <g key={i}>
                {rects.map((r) => (
                  <rect key={`${r.x},${r.y}`} x={r.x} y={r.y} width={r.width} height={1} fill={r.fill} />
                ))}
              </g>
            ))}
          </svg>
        )}
      </svg>
    </>
  );
}

function PondLayer({ art }: { art: ReturnType<typeof pondArt> }) {
  return (
    <>
      {pixelRects(art).map((r) => (
        <rect key={`${r.x},${r.y}`} x={r.x} y={r.y} width={r.width} height={1} fill={r.fill} />
      ))}
    </>
  );
}

/** 도감 한 칸: 나무 액자 안 도트 그림. 못 낚은 칸은 잉크색 실루엣(투명도 0.6)과 '???' */
function DexFrame({ cell, justCaught }: { cell: DexCell; justCaught: boolean }) {
  const art = catchArt(cell.code);
  const caught = cell.count > 0;
  return (
    <li
      className="flex flex-col items-center bg-(--kit-paper) p-3 text-center text-(--kit-ink) shadow-[inset_0_0_0_4px_var(--kit-wood),inset_0_0_0_6px_var(--kit-wood-edge),0_0_0_2px_var(--kit-wood-edge)]"
      data-dex-cell={cell.code}
      data-caught={caught ? "1" : "0"}
      {...(justCaught ? { "data-dex-new": "" } : {})}
    >
      <span className="mt-1 flex h-14 items-center justify-center" aria-hidden="true">
        <PixelArtSvg art={caught ? art : silhouetteArt(art)} cell={DEX_CELL} className={caught ? "" : "opacity-60"} />
      </span>
      {caught ? (
        <>
          <p className="mt-1 font-bold">
            {cell.name}
            {justCaught && <span className="px-chip ml-1 align-[2px]">새로</span>}
          </p>
          <p className="text-sm">{cell.coin === null ? "동물 먹이 1개" : `🪙 ${cell.coin}`}</p>
          <p className="mt-1 text-xs text-ink-soft">
            처음 낚은 날 <span data-dex-first={cell.first}>{firstFormat.format(new Date(`${cell.first}T00:00:00Z`))}</span>
          </p>
          <p className="text-xs text-ink-soft">
            <span data-dex-count={cell.count}>{cell.count}</span>번 낚았어요
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 font-bold text-ink-soft">???</p>
          <p className="text-sm text-ink-soft">아직 못 낚았어요</p>
        </>
      )}
    </li>
  );
}
