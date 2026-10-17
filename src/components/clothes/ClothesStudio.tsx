"use client";

import { useActionState, useMemo, useState } from "react";
import { outfitAction, type OutfitState } from "@/app/clothes/actions";
import { PixelLayers } from "@/components/game/PixelLayers";
import { WalkingMirror } from "@/components/game/WalkingMirror";
import { billButton, CLOTHES_TABS, outfitBill, type ClothesItem, type Outfit } from "@/lib/clothes";
import { formatNumber } from "@/lib/game";
import { avatarLayers, type AvatarSlot, type StyleSlot } from "@/lib/shop";

/** 옷 그림 키 묶음 (캐릭터 → 옷 → 소품 → 모자) */
function layersOf(character: string, style: Partial<Record<StyleSlot, string>>, outfit: Outfit, catalog: readonly ClothesItem[]): string[] {
  const art = (slot: AvatarSlot) => catalog.find((i) => i.id === outfit[slot])?.art;
  return avatarLayers(character, { ...style, clothes: art("clothes"), accessory: art("accessory"), hat: art("hat") });
}

/** 옷가게 (SHOP-08): 카드를 누르면 거울이 바로 그 모습이 되고, 계산서 버튼으로 한 번에 사서 입는다 */
export function ClothesStudio({
  character,
  style = {},
  catalog,
  current,
  level,
  coins,
}: {
  character: string;
  style?: Partial<Record<StyleSlot, string>>;
  catalog: ClothesItem[];
  current: Outfit;
  level: number;
  coins: number;
}) {
  const [outfit, setOutfit] = useState<Outfit>(current);
  const [tab, setTab] = useState<AvatarSlot>("clothes");
  const [state, action, pending] = useActionState<OutfitState, FormData>(outfitAction, null);
  const bill = useMemo(() => outfitBill(outfit, current, catalog, level, coins), [outfit, current, catalog, level, coins]);
  const layers = layersOf(character, style, outfit, catalog);
  const can = bill.kind === "ok";
  const pay = bill.kind === "ok" || bill.kind === "coins" ? bill.total : 0;

  const pick = (slot: AvatarSlot, id: number | null) => setOutfit((o) => ({ ...o, [slot]: id }));
  const tabInfo = CLOTHES_TABS.find((t) => t.slot === tab)!;
  const cards = catalog.filter((i) => i.slot === tab);

  return (
    <div className="grid gap-6 md:grid-cols-[18rem_1fr]">
      <section aria-label="거울" className="px-tile space-y-4 p-4 text-center">
        <WalkingMirror layers={layers} />
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
          {(["clothes", "hat", "accessory"] as const).map((slot) => (
            <input key={slot} type="hidden" name={slot} value={outfit[slot] ?? ""} />
          ))}
          <input type="hidden" name="pay" value={pay} />
          <button type="submit" className="px-btn px-btn--primary w-full" disabled={!can || pending} data-outfit-submit>
            {pending ? "입는 중…" : billButton(bill)}
          </button>
          {state && (
            <p role={state.ok ? "status" : "alert"} className={`text-sm font-semibold ${state.ok ? "px-gain" : "px-loss"}`} data-outfit-message>
              {state.message}
            </p>
          )}
        </form>
      </section>
      <section aria-label="고르기" className="min-w-0 space-y-3">
        <div className="px-tabs flex-wrap" role="tablist">
          {CLOTHES_TABS.map((t) => (
            <button key={t.slot} type="button" role="tab" aria-selected={tab === t.slot} className="px-tab" onClick={() => setTab(t.slot)}>
              {t.title}
            </button>
          ))}
        </div>
        <ul className="mt-1 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4" role="tabpanel" aria-label={tabInfo.title}>
          <li>
            <button type="button" className="px-tile flex h-full w-full flex-col items-center gap-1 p-3" aria-pressed={outfit[tab] === null} onClick={() => pick(tab, null)} data-outfit-card="none">
              <PixelLayers arts={layersOf(character, style, { ...outfit, [tab]: null }, catalog)} size={64} />
              <span className="font-semibold">{tabInfo.none}</span>
            </button>
          </li>
          {cards.map((item) => {
            const chosen = outfit[tab] === item.id;
            const worn = current[tab] === item.id;
            const locked = !item.owned && item.requiredLevel > level;
            return (
              <li key={item.id}>
                <button type="button" className="px-tile flex h-full w-full flex-col items-center gap-1 p-3" aria-pressed={chosen} onClick={() => pick(tab, item.id)} data-outfit-card={item.id}>
                  <PixelLayers arts={layersOf(character, style, { ...outfit, [tab]: item.id }, catalog)} size={64} />
                  <span className="font-semibold">{item.name}</span>
                  <span className="text-sm text-ink-soft">{worn ? "입는 중 ✓" : item.owned ? "보유 ✓" : locked ? `🔒 Lv.${item.requiredLevel}` : `🪙 ${formatNumber(item.price)}`}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
