"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { placeFurniture } from "@/app/house/actions";
import { PixelLayers } from "@/components/game/PixelLayers";
import { houseSummary, type HouseInfo } from "@/lib/house";
import type { OwnedFurniture, PlacedFurniture } from "@/server/house";

const SLOT_COLS: Record<number, string> = { 4: "grid-cols-4", 6: "grid-cols-3 sm:grid-cols-6", 8: "grid-cols-4 sm:grid-cols-8" };

/**
 * 🏠 우리 집 (SHOP-05·BLOG-04): 벽지·창문·나무 바닥 위의 가구 칸. 누구나 같은 집을 보고,
 * 주인만 [🛋 가구 놓기]로 칸을 눌러 가진 가구를 놓거나 옮기거나 비운다. 칸 이름은 1번부터.
 */
export function HouseRoom({ slug, info, placed, owned }: { slug: string; info: HouseInfo; placed: PlacedFurniture[]; owned: OwnedFurniture[] | null }) {
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const at = (slot: number) => placed.find((p) => p.slot === slot);

  const put = (slot: number, itemId: number | null) => {
    setError(null);
    startTransition(async () => {
      const result = await placeFurniture(String(slot), itemId === null ? null : String(itemId));
      if (result.ok) setPicking(null);
      else setError(result.error ?? null);
    });
  };

  return (
    <section aria-labelledby="house-title" className="rounded-2xl border border-line bg-surface p-5" data-house>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="house-title" className="text-lg font-bold">
            🏠 우리 집 · {info.stage}단계 {info.name}
          </h2>
          <p className="text-sm text-ink-soft" data-house-summary>
            {houseSummary(placed.filter((p) => p.slot < info.slots).length, info)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* 🚪 밖으로: 마을의 이 집 앞으로 (TOWN-01). 휴대폰에는 마을이 없어 숨긴다 */}
          <span className="contents max-sm:hidden">
            <Link href={`/town?at=${slug}`} className="btn">
              🚪 밖으로
            </Link>
          </span>
          {owned && (
            <button
              type="button"
              className={`btn ${editing ? "btn-primary" : ""}`}
              disabled={pending}
              onClick={() => {
                setEditing(!editing);
                setPicking(null);
                setError(null);
              }}
            >
              {editing ? "✓ 다 놓았어요" : "🛋 가구 놓기"}
            </button>
          )}
        </div>
      </div>

      {/* 방: 벽지·창문 위, 나무 바닥 위에 칸 */}
      <div className="relative mt-3 overflow-hidden rounded-xl border border-line" style={{ background: "linear-gradient(#f6e7c8 0 58%, #c8935a 58% 100%)" }}>
        <div aria-hidden="true" className="absolute left-1/2 top-4 h-14 w-20 -translate-x-1/2 rounded border-4 border-[#9a6a3a] bg-[#bfe6ff]">
          <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-[#9a6a3a]" />
        </div>
        <ul className={`relative grid ${SLOT_COLS[info.slots] ?? "grid-cols-4"} gap-2 px-3 pb-3 pt-24`} aria-label="가구 칸">
          {Array.from({ length: info.slots }, (_, slot) => {
            const item = at(slot);
            const n = slot + 1;
            const art = item ? <PixelLayers arts={[item.art]} size={64} label={item.name} /> : null;
            return (
              <li key={slot} className="flex justify-center" data-slot={slot} data-furniture={item?.name ?? ""}>
                {editing ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setPicking(slot);
                      setError(null);
                    }}
                    aria-label={item ? `${n}번 칸: ${item.name} 바꾸기` : `${n}번 칸에 가구 놓기`}
                    aria-pressed={picking === slot}
                    className={`flex h-20 w-full max-w-20 items-center justify-center rounded-lg border-2 border-dashed ${picking === slot ? "border-yellow-400 bg-yellow-50/70" : "border-[#7a4a2a]/50 bg-white/30"}`}
                  >
                    {art ?? <span className="text-2xl text-[#7a4a2a]">＋</span>}
                  </button>
                ) : (
                  <div className="flex h-20 w-full max-w-20 items-end justify-center">{art}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {error && (
        <p role="alert" className="form-error mt-3">
          {error}
        </p>
      )}

      {editing && picking !== null && owned && (
        <div className="mt-3 rounded-xl border border-line bg-bg p-3" data-furniture-picker>
          <p className="font-semibold">{picking + 1}번 칸에 놓을 가구를 골라 주세요</p>
          <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {owned.map((f) => {
              const here = at(picking)?.itemId === f.id;
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    disabled={here || pending}
                    onClick={() => put(picking, f.id)}
                    className={`flex w-full flex-col items-center rounded-lg border p-2 text-sm ${here ? "border-yellow-400 bg-yellow-50" : "border-line bg-surface hover:bg-bg"}`}
                    data-pick={f.name}
                  >
                    <PixelLayers arts={[f.art]} size={48} />
                    <span className="mt-1">{f.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button type="button" className="btn" disabled={!at(picking) || pending} onClick={() => put(picking, null)}>
              🧹 비우기
            </button>
            <p className="text-sm text-ink-soft">
              가구는{" "}
              <Link href="/shop" className="font-semibold text-accent underline">
                상점
              </Link>
              에서 더 살 수 있어요.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
