"use client";

import Link from "next/link";
import { useActionState } from "react";
import { castLine, type CastState } from "@/app/fishing/actions";
import { CATCHES, findCatch, prizeLine, todayLine, type CatchCode } from "@/lib/fishing";
import type { FishingLog } from "@/server/fishing";

const dayFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", month: "long", day: "numeric", weekday: "short" });

/** 낚시터 화면 (TOWN-14): 던지기 전에는 버튼, 낚은 뒤(또는 오늘 이미 낚았으면)는 결과 */
export function FishingView({ today, recent }: { today: CatchCode | null; recent: FishingLog[] }) {
  const [state, action, pending] = useActionState<CastState, FormData>(castLine, null);
  const caught = state?.ok ? state.catch : today;
  const fresh = state?.ok === true;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-sky-50 p-6 text-center dark:bg-sky-950/30" aria-label="연못" data-fishing={caught ?? "ready"}>
        {caught === null ? (
          <>
            <p className="text-5xl" aria-hidden="true">
              🌊
            </p>
            <p className="mt-2 font-semibold">연못에 낚싯대를 던져 볼까요?</p>
            {state && !state.ok && (
              <p role="alert" className="mt-2 font-semibold text-red-700">
                {state.message}
              </p>
            )}
            <form action={action} className="mt-4">
              <button type="submit" className="btn btn-primary" disabled={pending}>
                {pending ? "기다리는 중…" : "🎣 낚싯대 던지기"}
              </button>
            </form>
          </>
        ) : (
          <div role="status">
            <p className="text-5xl" aria-hidden="true">
              {findCatch(caught)!.emoji}
            </p>
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

      <section aria-labelledby="fishing-catches">
        <h2 id="fishing-catches" className="font-bold">
          🐟 낚을 수 있는 것
        </h2>
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATCHES.map((c) => (
            <li key={c.code} className="rounded-xl border border-line bg-surface p-3 text-center">
              <span className="text-2xl" aria-hidden="true">
                {c.emoji}
              </span>
              <p className="font-semibold">{c.name}</p>
              <p className="text-sm text-ink-soft">{c.coin === null ? "동물 먹이 1개" : `🪙 ${c.coin}`}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="fishing-log">
        <h2 id="fishing-log" className="font-bold">
          📒 최근 낚시 기록
        </h2>
        {recent.length === 0 && !fresh ? (
          <p className="mt-2 text-ink-soft">아직 낚시 기록이 없어요.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface" data-fishing-log>
            {recent.map((r) => {
              const c = findCatch(r.catch)!;
              return (
                <li key={r.date} className="flex justify-between px-4 py-2">
                  <span>{dayFormat.format(new Date(`${r.date}T00:00:00Z`))}</span>
                  <span>
                    {c.emoji} {c.name}
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
