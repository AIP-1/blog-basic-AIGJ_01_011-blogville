"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { chooseRoofColor, placeFurniture } from "@/app/house/actions";
import { PixelLayers } from "@/components/game/PixelLayers";
import { houseArt } from "@/lib/art/town";
import { pixelRects } from "@/lib/art/characters";
import { houseSummary, type HouseInfo } from "@/lib/house";
import { ROOF_HEX, ROOF_LABELS, roofOpenLevel, type RoofCode } from "@/lib/roof";
import type { OwnedFurniture, PlacedFurniture } from "@/server/house";

/** 주인에게만: 지금 지붕 색, 이 블로그의 10색 순서, 열린 수 (TOWN-07) */
export type RoofChoice = { current: RoofCode; order: RoofCode[]; unlocked: number };

/** 마을에 서는 내 집 그림 (지붕 색 미리 보기) */
function HousePreview({ stage, roof }: { stage: number; roof: RoofCode }) {
  const art = houseArt(stage, ROOF_HEX[roof]);
  return (
    <svg viewBox={`0 0 ${art.rows[0].length} ${art.rows.length}`} width={art.rows[0].length * 3} height={art.rows.length * 3} shapeRendering="crispEdges" role="img" aria-label={`${ROOF_LABELS[roof]} 지붕의 우리 집`} data-roof-preview={roof}>
      {pixelRects(art).map((r) => (
        <rect key={`${r.x},${r.y}`} x={r.x} y={r.y} width={r.width} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}

const SLOT_COLS: Record<number, string> = { 4: "grid-cols-4", 6: "grid-cols-3 sm:grid-cols-6", 8: "grid-cols-4 sm:grid-cols-8" };

/**
 * 🏠 우리 집 (SHOP-05·BLOG-04): 벽지·창문·나무 바닥 위의 가구 칸. 누구나 같은 집을 보고,
 * 주인만 [🛋 가구 놓기]로 칸을 눌러 가진 가구를 놓거나 옮기거나 비운다. 칸 이름은 1번부터.
 * 주인은 [🏠 지붕 색]으로 마을에 보일 지붕 색을 열린 색 중에서 고른다 (TOWN-07, specs/041-roof-color).
 */
export function HouseRoom({
  slug,
  welcome = false,
  info,
  placed,
  owned,
  roof = null,
}: {
  slug: string;
  welcome?: boolean;
  info: HouseInfo;
  placed: PlacedFurniture[];
  owned: OwnedFurniture[] | null;
  roof?: RoofChoice | null;
}) {
  const [editing, setEditing] = useState(false);
  const [roofing, setRoofing] = useState(false);
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

  const paint = (code: RoofCode) => {
    setError(null);
    startTransition(async () => {
      const result = await chooseRoofColor(code);
      if (!result.ok) setError(result.error ?? null);
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
          {/* 🚪 밖으로: 마을의 이 집 앞으로 (TOWN-01). 가입 직후면 첫 마을 환영으로, 노란 테두리로 깜빡인다. 휴대폰에는 마을이 없어 숨긴다 */}
          <span className="contents max-sm:hidden">
            <Link href={welcome ? "/town?welcome=1" : `/town?at=${slug}`} className={`btn ${welcome ? "door-welcome" : ""}`}>
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
                setRoofing(false);
                setPicking(null);
                setError(null);
              }}
            >
              {editing ? "✓ 다 놓았어요" : "🛋 가구 놓기"}
            </button>
          )}
          {roof && (
            <button
              type="button"
              className={`btn ${roofing ? "btn-primary" : ""}`}
              disabled={pending}
              aria-expanded={roofing}
              onClick={() => {
                setRoofing(!roofing);
                setEditing(false);
                setPicking(null);
                setError(null);
              }}
            >
              {roofing ? "✓ 다 골랐어요" : "🏠 지붕 색"}
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

      {roofing && roof && (
        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-bg p-3" data-roof-picker>
          <HousePreview stage={info.stage} roof={roof.current} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">광장에 보일 지붕 색을 골라 주세요</p>
            <p className="text-sm text-ink-soft">처음 색은 무작위로 받았어요. 집이 한 단계 클 때마다 색이 하나씩 늘어요 ({roof.unlocked}/10색).</p>
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="지붕 색">
              {roof.order.map((code, i) => {
                const open = i < roof.unlocked;
                const on = code === roof.current;
                return (
                  <li key={code} className="flex w-12 flex-col items-center">
                    {open ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => !on && paint(code)}
                        aria-label={ROOF_LABELS[code]}
                        aria-pressed={on}
                        className={`flex size-11 items-center justify-center rounded-full border-2 font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] ${on ? "border-ink" : "border-white"}`}
                        style={{ background: ROOF_HEX[code] }}
                        data-roof={code}
                      >
                        {on ? "✓" : ""}
                      </button>
                    ) : (
                      <span
                        className="flex size-11 items-center justify-center rounded-full border-2 border-dashed border-ink-soft/50 text-sm"
                        aria-label={`잠긴 색, Lv.${roofOpenLevel(i)}에 열려요`}
                        role="img"
                        data-roof-locked
                      >
                        🔒
                      </span>
                    )}
                    <span className="text-xs text-ink-soft">{open ? ROOF_LABELS[code] : `Lv.${roofOpenLevel(i)}`}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
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
