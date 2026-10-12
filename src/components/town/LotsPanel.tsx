"use client";

import { useState } from "react";
import { chooseTownLot } from "@/app/town/actions";
import { lotArea, NEIGHBOR_LOTS } from "@/lib/town/lots";
import type { TownSpot } from "@/lib/town/structures";
import type { TownHouse } from "@/server/town";

/**
 * ☰ 🏡 이웃 집 자리 (TOWN-18, specs/049-town-lots): 1~10번 자리와 사는 이웃. [고르기]를 누르면(또는 마을의 빈 집터에서 Space)
 * 그 자리에 살 ⭐ 즐겨찾기 이웃을 고른다. 다른 이웃이 살던 자리면 서로 맞바꾼다. ✨로 그 자리 앞에 텔레포트한다.
 */
export function LotsPanel({
  houses,
  spots,
  picked,
  onPick,
  onTeleport,
}: {
  houses: TownHouse[];
  spots: TownSpot[];
  /** 고르는 중인 자리 (null이면 자리 목록) */
  picked: number | null;
  onPick: (lot: number | null) => void;
  onTeleport: (spot: TownSpot) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const neighbors = houses.filter((h) => h.lot > 0).sort((a, b) => a.lot - b.lot);
  const at = (lot: number) => neighbors.find((h) => h.lot === lot);

  if (picked === null) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-ink-soft">⭐ 즐겨찾는 이웃이 어느 자리에 살지 골라요. 안 고른 이웃은 남은 자리에 차례로 서요.</p>
        <ul className="divide-y divide-line" aria-label="이웃 집 자리">
          {NEIGHBOR_LOTS.map((lot) => {
            const house = at(lot);
            // 빈 집터에도 갈 수 있다 (가서 Space면 이 창이 다시 열린다)
            const spot = spots.find((s) => s.id === `house:${lot}` || s.id === `lot:${lot}`);
            return (
              <li key={lot} className="flex items-center gap-1 py-1.5" data-lot={lot} data-lot-owner={house?.nickname ?? ""}>
                <span className="min-w-0 flex-1 px-1">
                  <span className="block truncate font-semibold">
                    {lot}번 · {house ? `🏠 ${house.nickname}의 집` : "빈 집터"}
                  </span>
                  <span className="block text-xs text-ink-soft">{lotArea(lot)}</span>
                </span>
                {spot && (
                  <button type="button" className="btn btn-ghost min-w-11 px-2" aria-label={`${lot}번 자리로 텔레포트`} onClick={() => onTeleport({ ...spot, enabled: true })}>
                    ✨
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  aria-label={`${lot}번 자리 고르기`}
                  onClick={() => {
                    setError(null);
                    onPick(lot);
                  }}
                >
                  고르기
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const occupant = at(picked);
  return (
    <div className="space-y-2" data-lot-picker={picked}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setError(null);
            onPick(null);
          }}
        >
          ‹ 자리 목록
        </button>
        <p className="font-bold">
          {picked}번 자리 · {lotArea(picked)}
        </p>
      </div>
      {neighbors.length === 0 ? (
        <p className="text-ink-soft">⭐ 즐겨찾는 이웃이 없어요. 👫 친구 목록에서 ⭐를 누르면 이 자리에 집이 생겨요.</p>
      ) : (
        <ul className="grid gap-1" aria-label={`${picked}번 자리에 살 이웃`}>
          {neighbors.map((h) => (
            <li key={h.userId}>
              {h.lot === picked ? (
                <p className="flex min-h-11 flex-col justify-center rounded-xl border border-line px-3 py-1.5" data-lot-choice={h.nickname}>
                  <span className="font-semibold">{h.nickname}</span>
                  <span className="text-xs text-ink-soft">지금 이 자리에 살아요</span>
                </p>
              ) : (
                <form
                  action={async (formData) => {
                    const result = await chooseTownLot(formData);
                    setError(result.error);
                    if (!result.error) onPick(null);
                  }}
                >
                  <input type="hidden" name="followeeId" value={h.userId} />
                  <input type="hidden" name="lot" value={picked} />
                  <button type="submit" className="btn h-auto min-h-11 w-full flex-col items-start py-1.5 text-left" data-lot-choice={h.nickname}>
                    <span>{h.nickname}</span>
                    <span className="text-xs font-normal text-ink-soft">
                      지금 {h.lot}번 자리 → {occupant ? `${occupant.nickname}님과 자리 바꾸기` : "이 자리로 옮기기"}
                    </span>
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-[#b71c1c]">
          {error}
        </p>
      )}
    </div>
  );
}
