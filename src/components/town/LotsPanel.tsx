"use client";

import { useState, useTransition } from "react";
import { chooseTownLot, inviteNeighbor } from "@/app/town/actions";
import { lotArea, NEIGHBOR_LOTS } from "@/lib/town/lots";
import type { TownSpot } from "@/lib/town/structures";
import type { TownHouse } from "@/server/town";

/**
 * [⭐ 이웃 맺고 여기 모시기] (plaza-upgrade-2, B1): 빈 집터에 선 이사 올 이웃(`suggested`)을 이웃 추가·⭐하고 그 자리에 둔다.
 * 우체통 창과 🏡 이웃 집 자리 창이 같이 쓴다. 모시면 광장이 다시 그려져 그 집이 보통 이웃 집이 된다(서 있던 자리는 그대로).
 */
export function InviteButton({ house, label = "⭐ 이웃 맺고 여기 모시기", small = true }: { house: Pick<TownHouse, "slug" | "lot" | "nickname">; label?: string; small?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={`px-btn px-btn--primary ${small ? "px-btn--sm" : ""}`}
        disabled={pending}
        aria-label={`${label}: ${house.nickname}님을 ${house.lot}번 자리에`}
        data-invite={house.slug}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await inviteNeighbor(house.slug, house.lot);
            if ("error" in result) setError(result.error);
          });
        }}
      >
        {pending ? "모시는 중…" : label}
      </button>
      {error && (
        <p role="alert" className="basis-full text-sm font-semibold text-(--danger)">
          {error}
        </p>
      )}
    </>
  );
}

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
  // 이사 올 이웃(추천 집)의 자리는 빈 자리로 친다 (그 자리를 골라 내 이웃을 옮길 수 있다)
  const neighbors = houses.filter((h) => h.lot > 0 && !h.suggested).sort((a, b) => a.lot - b.lot);
  const suggested = houses.filter((h) => h.suggested).sort((a, b) => b.lot - a.lot);
  const at = (lot: number) => neighbors.find((h) => h.lot === lot);
  const guest = (lot: number) => suggested.find((h) => h.lot === lot);

  if (picked === null) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-(--kit-ink-soft)">⭐ 즐겨찾는 이웃이 어느 자리에 살지 골라요. 안 고른 이웃은 남은 자리에 차례로 서요.</p>
        <ul className="divide-y-2 divide-(--kit-paper-2)" aria-label="이웃 집 자리">
          {NEIGHBOR_LOTS.map((lot) => {
            const house = at(lot);
            const moving = house ? undefined : guest(lot);
            // 빈 집터에도 갈 수 있다 (가서 Space면 이 창이 다시 열린다)
            const spot = spots.find((s) => s.id === `house:${lot}` || s.id === `lot:${lot}`);
            return (
              <li key={lot} className="flex items-center gap-1 py-1.5" data-lot={lot} data-lot-owner={house?.nickname ?? ""}>
                <span className="min-w-0 flex-1 px-1">
                  <span className="block truncate font-semibold">
                    {lot}번 · {house ? `🏠 ${house.nickname}의 집` : "빈 집터"}
                  </span>
                  <span className="block text-xs text-(--kit-ink-soft)">
                    {lotArea(lot)}
                    {moving && ` · 🏡 ${moving.nickname}님이 이사 올 수 있어요`}
                  </span>
                </span>
                {spot && (
                  <button type="button" className="px-btn px-btn--quiet px-btn--sm" aria-label={`${lot}번 자리로 텔레포트`} onClick={() => onTeleport({ ...spot, enabled: true })}>
                    ✨
                  </button>
                )}
                <button
                  type="button"
                  className="px-btn px-btn--sm"
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
          className="px-btn px-btn--quiet px-btn--sm"
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
        <SuggestList suggested={suggested} lot={picked} />
      ) : (
        <ul className="grid gap-2 p-0.5" aria-label={`${picked}번 자리에 살 이웃`}>
          {neighbors.map((h) => (
            <li key={h.userId}>
              {h.lot === picked ? (
                <p className="flex min-h-11 flex-col justify-center px-3 py-1.5 shadow-[inset_0_0_0_2px_var(--kit-paper-2)]" data-lot-choice={h.nickname}>
                  <span className="font-semibold">{h.nickname}</span>
                  <span className="text-xs text-(--kit-ink-soft)">지금 이 자리에 살아요</span>
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
                  <button
                    type="submit"
                    className="flex min-h-11 w-full flex-col items-start bg-(--kit-paper-2) px-3 py-1.5 text-left shadow-[0_-2px_0_0_var(--kit-ink),0_2px_0_0_var(--kit-ink),-2px_0_0_0_var(--kit-ink),2px_0_0_0_var(--kit-ink)] hover:bg-(--kit-paper-hover)"
                    data-lot-choice={h.nickname}
                  >
                    <span className="font-semibold">{h.nickname}</span>
                    <span className="text-xs text-(--kit-ink-soft)">
                      지금 {h.lot}번 자리 → {occupant ? `${occupant.nickname}님과 자리 바꾸기` : "이 자리로 옮기기"}
                    </span>
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {neighbors.length > 0 && suggested.length > 0 && (
        <details className="pt-1">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold">🏡 새 이웃 모시기</summary>
          <SuggestList suggested={suggested} lot={occupant ? null : picked} />
        </details>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-(--danger)">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * 오늘의 이사 올 이웃 (빈 집터 고르기 창의 막다른 문구 대신, B1): 그날 마을 빈 집터에 선 후보 3명과 [모시기].
 * 모시면 고르는 중인 자리(`lot`)에 선다. 후보가 없으면(이웃 10명·후보 없음) 예전 안내.
 */
function SuggestList({ suggested, lot }: { suggested: readonly TownHouse[]; lot: number | null }) {
  if (suggested.length === 0) {
    return <p className="text-(--kit-ink-soft)">⭐ 즐겨찾는 이웃이 없어요. 👫 친구 목록에서 ⭐를 누르면 이 자리에 집이 생겨요.</p>;
  }
  return (
    <div className="space-y-2" data-lot-suggest>
      <p className="text-sm text-(--kit-ink-soft)">오늘 이사 올 수 있는 이웃이에요. 모시면 ⭐ 즐겨찾는 이웃이 되고 {lot === null ? "지금 선 빈 집터" : `${lot}번 자리`}에 집이 서요.</p>
      <ul className="grid gap-2 p-0.5" aria-label="이사 올 이웃">
        {suggested.map((h) => (
          <li key={h.userId} className="flex flex-wrap items-center gap-2 bg-(--kit-paper-2) px-3 py-2" data-suggest={h.slug}>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{h.nickname}</span>
              {h.recentPosts[0] ? (
                <span className="block truncate font-(family-name:--blog-serif) text-xs font-bold text-(--kit-ink-soft)">{h.recentPosts[0].title}</span>
              ) : (
                <span className="block truncate text-xs text-(--kit-ink-soft)">{h.blogTitle}</span>
              )}
            </span>
            <InviteButton house={{ ...h, lot: lot ?? h.lot }} label="모시기" />
          </li>
        ))}
      </ul>
    </div>
  );
}
