"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { styleAction, type StyleState } from "@/app/salon/actions";
import { PixelLayers } from "@/components/game/PixelLayers";
import { findArt } from "@/lib/art";
import type { PixelArt } from "@/lib/art/characters";
import { walkFrame, WALK_FPS, WALK_FRAMES, type WalkDir } from "@/lib/art/walk";
import { SALON_TABS, styleBill, styleButton, type SalonItem, type Style } from "@/lib/salon";
import { formatNumber } from "@/lib/game";
import { avatarLayers, HAIR_CHARACTERS_LIST, type AvatarSlot, type StyleSlot } from "@/lib/shop";

const DIRS: readonly { dir: WalkDir; label: string }[] = [
  { dir: "down", label: "앞" },
  { dir: "left", label: "왼쪽" },
  { dir: "up", label: "뒤" },
  { dir: "right", label: "오른쪽" },
];

/** 그림 키 묶음: 입은 옷 + 고른 머리 */
function layersOf(character: string, worn: Partial<Record<AvatarSlot, string>>, style: Style, catalog: readonly SalonItem[]): string[] {
  const art = (slot: StyleSlot) => catalog.find((i) => i.id === style[slot])?.art;
  return avatarLayers(character, { ...worn, hair: art("hair"), hair_color: art("hair_color") });
}

/** 거울: 고른 모습이 그 방향으로 걷는다 */
function Mirror({ layers, dir, walking }: { layers: readonly string[]; dir: WalkDir; walking: boolean }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!walking) return;
    const timer = setInterval(() => setFrame((f) => (f % WALK_FRAMES) + 1), 1000 / WALK_FPS);
    return () => clearInterval(timer);
  }, [walking]);
  const arts = layers.flatMap((k) => {
    const a = findArt(k);
    return a ? [a] : ([] as PixelArt[]);
  });
  const grid = walkFrame(arts, dir, walking ? frame : 0);
  return (
    <svg viewBox="0 0 16 16" width={192} height={192} shapeRendering="crispEdges" role="img" aria-label="거울에 비친 내 모습" data-mirror={layers.join(" ")} data-mirror-dir={dir}>
      {grid.flatMap((row, y) => row.map((color, x) => (color ? <rect key={`${x}:${y}`} x={x} y={y} width={1} height={1} fill={color} /> : null)))}
    </svg>
  );
}

/** 미용실 (SHOP-07): 카드를 누르면 거울이 바로 그 머리가 되고, 계산서 버튼으로 한 번에 사서 바꾼다 */
export function SalonStudio({
  character,
  worn,
  catalog,
  current,
  level,
  coins,
}: {
  character: string;
  worn: Partial<Record<AvatarSlot, string>>;
  catalog: SalonItem[];
  current: Style;
  level: number;
  coins: number;
}) {
  // 동물 캐릭터는 카드·거울을 남자 주민에게 입혀 보여 준다
  const human = HAIR_CHARACTERS_LIST.includes(character);
  const model = human ? character : "char.boy";
  const [outfit, setOutfit] = useState<Style>(current);
  const [tab, setTab] = useState<StyleSlot>("hair");
  const [dir, setDir] = useState<WalkDir>("down");
  const [walking, setWalking] = useState(true);
  const [state, action, pending] = useActionState<StyleState, FormData>(styleAction, null);
  const bill = useMemo(() => styleBill(outfit, current, catalog, level, coins), [outfit, current, catalog, level, coins]);
  const layers = layersOf(model, worn, outfit, catalog);
  const can = bill.kind === "ok";
  const pay = bill.kind === "ok" || bill.kind === "coins" ? bill.total : 0;

  const pick = (slot: StyleSlot, id: number | null) => setOutfit((o) => ({ ...o, [slot]: id }));
  const tabInfo = SALON_TABS.find((t) => t.slot === tab)!;
  const cards = catalog.filter((i) => i.slot === tab);

  return (
    <div className="grid gap-6 md:grid-cols-[18rem_1fr]">
      <section aria-label="거울" className="space-y-3 rounded-3xl border border-line bg-surface p-4 text-center">
        {!human && <p className="rounded-xl bg-bg p-2 text-sm text-ink-soft" data-salon-animal>털이 있는 친구는 머리를 바꿀 수 없어서 남자 주민에게 입혀 보여 줘요. 산 머리는 사람 캐릭터로 바꾸면 보여요.</p>}
        <div className="mx-auto w-fit rounded-[2rem] border-8 border-[#c58b4f] bg-[#eaf6ff] p-3">
          <Mirror layers={layers} dir={dir} walking={walking} />
        </div>
        <div className="flex flex-wrap justify-center gap-1" role="group" aria-label="돌려 보기">
          {DIRS.map((d) => (
            <button key={d.dir} type="button" className={`rounded-xl border border-line px-3 py-2 text-sm font-semibold ${dir === d.dir ? "bg-ink text-surface" : "bg-surface"}`} aria-pressed={dir === d.dir} onClick={() => setDir(d.dir)}>
              {d.label}
            </button>
          ))}
          <button type="button" className="rounded-xl border border-line px-3 py-2 text-sm font-semibold" aria-pressed={walking} onClick={() => setWalking((w) => !w)}>
            {walking ? "⏸ 멈춤" : "▶ 걷기"}
          </button>
        </div>
        <form action={action} className="space-y-2 border-t border-line pt-3 text-left" data-bill={bill.kind}>
          <h2 className="font-bold">🧾 계산서</h2>
          {(bill.kind === "ok" || bill.kind === "coins") && bill.buy.length > 0 ? (
            <ul className="space-y-1 text-sm" data-bill-items>
              {bill.buy.map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <span>{i.name}</span>
                  <span>🪙 {formatNumber(i.price)}</span>
                </li>
              ))}
              <li className="flex justify-between gap-2 border-t border-line pt-1 font-bold">
                <span>합계</span>
                <span data-bill-total>🪙 {formatNumber(bill.total)}</span>
              </li>
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">{bill.kind === "same" ? "지금 입은 모습이에요. 카드를 눌러 입어 보세요." : bill.kind === "level" ? "아직 레벨이 모자란 아이템이 있어요." : "새로 살 것이 없어요."}</p>
          )}
          {(["hair", "hair_color"] as const).map((slot) => (
            <input key={slot} type="hidden" name={slot} value={outfit[slot] ?? ""} />
          ))}
          <input type="hidden" name="pay" value={pay} />
          <button type="submit" className="btn btn-primary w-full" disabled={!can || pending} data-style-submit>
            {pending ? "바꾸는 중…" : styleButton(bill)}
          </button>
          {state && (
            <p role={state.ok ? "status" : "alert"} className={`text-sm font-semibold ${state.ok ? "text-accent" : "text-danger"}`} data-style-message>
              {state.message}
            </p>
          )}
        </form>
      </section>
      <section aria-label="고르기" className="space-y-3">
        <div className="flex flex-wrap gap-1" role="tablist">
          {SALON_TABS.map((t) => (
            <button key={t.slot} type="button" role="tab" aria-selected={tab === t.slot} className={`rounded-xl border border-line px-4 py-2 font-bold ${tab === t.slot ? "bg-ink text-surface" : "bg-surface"}`} onClick={() => setTab(t.slot)}>
              {t.title}
            </button>
          ))}
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" role="tabpanel" aria-label={tabInfo.title}>
          <li>
            <button type="button" className={`flex h-full w-full flex-col items-center gap-1 rounded-2xl border p-3 ${outfit[tab] === null ? "border-accent ring-2 ring-accent" : "border-line"} bg-surface`} aria-pressed={outfit[tab] === null} onClick={() => pick(tab, null)} data-style-card="none">
              <PixelLayers arts={layersOf(model, worn, { ...outfit, [tab]: null }, catalog)} size={64} />
              <span className="font-semibold">{tabInfo.none}</span>
            </button>
          </li>
          {cards.map((item) => {
            const chosen = outfit[tab] === item.id;
            const isWorn = current[tab] === item.id;
            const locked = !item.owned && item.requiredLevel > level;
            return (
              <li key={item.id}>
                <button type="button" className={`flex h-full w-full flex-col items-center gap-1 rounded-2xl border p-3 ${chosen ? "border-accent ring-2 ring-accent" : "border-line"} bg-surface`} aria-pressed={chosen} onClick={() => pick(tab, item.id)} data-style-card={item.id}>
                  <PixelLayers arts={layersOf(model, worn, { ...outfit, [tab]: item.id }, catalog)} size={64} />
                  <span className="font-semibold">{item.name}</span>
                  <span className="text-sm text-ink-soft">{isWorn ? "입는 중 ✓" : item.owned ? "보유 ✓" : locked ? `🔒 Lv.${item.requiredLevel}` : item.price === 0 ? "무료" : `🪙 ${formatNumber(item.price)}`}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
