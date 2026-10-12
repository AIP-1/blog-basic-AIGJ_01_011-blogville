"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { buyItem, type BuyState } from "@/app/shop/actions";
import { PixelLayers } from "@/components/game/PixelLayers";
import { formatNumber } from "@/lib/game";
import { buttonState, isAvatarType, isShopSort, sectionOf, SHOP_EMPTY, SHOP_SECTIONS, SHOP_SORTS, sortShopItems, type ShopItem, type ShopSort } from "@/lib/shop";

/**
 * 상점 화면 (SHOP-01). 정렬은 이 화면에서만 유지한다(새로고침하면 레벨순).
 * 사는 동안에는 모든 [사기]를 잠가 두 번 눌러도 한 번만 보낸다.
 */
export function ShopView({ items, level, coins, mySlug }: { items: ShopItem[]; level: number; coins: number; mySlug: string }) {
  const [sort, setSort] = useState<ShopSort>("level");
  const [state, action, pending] = useActionState<BuyState, FormData>(buyItem, null);
  const sorted = sortShopItems(items, sort);

  return (
    <div className="space-y-6">
      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`sticky top-0 z-10 rounded-xl border px-4 py-3 font-semibold shadow-sm ${state.ok ? "border-green-300 bg-green-50 text-green-800" : "border-red-300 bg-red-50 text-red-700"}`}
          data-buy-result={state.ok ? "ok" : "error"}
        >
          {state.message}
          {state.ok && (
            <Link href={state.type === "furniture" ? `/@${mySlug}` : "/closet"} className="ml-2 underline">
              {state.type === "furniture" ? "🏠 우리 집으로" : "🎨 꾸미기로"}
            </Link>
          )}
        </p>
      )}

      <label className="flex items-center gap-2 text-sm font-semibold">
        정렬
        <select className="field field-auto" value={sort} onChange={(e) => isShopSort(e.target.value) && setSort(e.target.value)}>
          {SHOP_SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      {SHOP_SECTIONS.map((section) => {
        const list = sorted.filter((item) => sectionOf(item.type) === section.key);
        return (
          <section key={section.key} aria-labelledby={`shop-${section.key}`} data-shop-section={section.key}>
            <h2 id={`shop-${section.key}`} className="text-lg font-bold">
              {section.title}
            </h2>
            {section.hint && <p className="mt-1 text-sm text-ink-soft">{section.hint}</p>}
            {list.length === 0 ? (
              <p className="mt-2 text-ink-soft">{SHOP_EMPTY}</p>
            ) : (
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {list.map((item) => (
                  <ShopCard key={item.id} item={item} level={level} coins={coins} action={action} pending={pending} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ShopCard({ item, level, coins, action, pending }: { item: ShopItem; level: number; coins: number; action: (formData: FormData) => void; pending: boolean }) {
  const state = buttonState(item, level, coins);
  const label = state.kind === "owned" ? "보유 중" : state.kind === "level" ? `🔒 Lv.${state.level}` : state.kind === "coins" ? "코인 부족" : "사기";
  return (
    <li
      className={`flex flex-col rounded-2xl border border-line bg-surface p-3 ${state.kind === "owned" ? "opacity-60" : ""}`}
      data-item={item.name}
      aria-label={item.name}
    >
      <div className="flex justify-center rounded-xl bg-bg p-2">
        <PixelLayers arts={isAvatarType(item.type) ? ["mannequin", item.art] : [item.art]} size={80} />
      </div>
      <h3 className="mt-2 font-bold">{item.name}</h3>
      <p className="mt-1 flex-1 text-sm text-ink-soft">{item.description}</p>
      <p className="mt-2 text-sm font-semibold">
        🪙 {formatNumber(item.price)}
        {item.requiredLevel >= 2 && <span className="ml-2 rounded-full bg-accent/10 px-1.5 text-accent">Lv.{item.requiredLevel}+</span>}
      </p>
      <form action={action} className="mt-2">
        <input type="hidden" name="itemId" value={item.id} />
        <button type="submit" className={`btn w-full ${state.kind === "buy" ? "btn-primary" : ""}`} disabled={state.kind !== "buy" || pending}>
          {label}
        </button>
      </form>
    </li>
  );
}
