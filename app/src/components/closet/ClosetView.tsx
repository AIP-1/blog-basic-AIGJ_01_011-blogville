"use client";

import { useEffect, useState, useTransition } from "react";
import { equipItem } from "@/app/closet/actions";
import { Miniroom } from "@/components/game/Miniroom";
import { PixelLayers } from "@/components/game/PixelLayers";
import { avatarLayers, CLOSET_ERRORS, isAvatarSlot, type AvatarSlot } from "@/lib/shop";
import type { ClosetItem } from "@/server/items";

type Look = { background: number | null; equips: Partial<Record<AvatarSlot, number>> };

function lookOf(avatar: ClosetItem[], backgrounds: ClosetItem[]): Look {
  const equips: Partial<Record<AvatarSlot, number>> = {};
  for (const i of avatar) if (i.equipped && isAvatarSlot(i.type)) equips[i.type] = i.id;
  return { background: backgrounds.find((b) => b.equipped)?.id ?? null, equips };
}

/** 누르면 미니룸을 바로 바꾸고 저장한다. 실패하면 원래 모습으로 되돌린다 (SHOP-04·06) */
export function ClosetView({
  character,
  nickname,
  avatar,
  backgrounds,
  furniture,
}: {
  character: string | null;
  nickname: string;
  avatar: ClosetItem[];
  backgrounds: ClosetItem[];
  furniture: ClosetItem[];
}) {
  const [look, setLook] = useState<Look>(() => lookOf(avatar, backgrounds));
  const [notice, setNotice] = useState<{ ok: boolean; message: string; at: number } | null>(null);
  const [, startTransition] = useTransition();
  const all = [...avatar, ...backgrounds];
  const art = (id: number | null | undefined) => all.find((i) => i.id === id)?.art;

  // 저장했어요 표시는 2초 뒤 사라진다
  useEffect(() => {
    if (!notice?.ok) return;
    const timer = setTimeout(() => setNotice((n) => (n?.at === notice.at ? null : n)), 2000);
    return () => clearTimeout(timer);
  }, [notice]);

  const choose = (item: ClosetItem) => {
    // 이 클릭이 바꾸는 칸 하나(배경 또는 부위)와 그 칸의 전·후 값
    let key: "background" | AvatarSlot;
    let prev: number | null;
    let next: number | null;
    if (item.type === "background") {
      key = "background";
      prev = look.background;
      next = item.id;
    } else if (isAvatarSlot(item.type)) {
      key = item.type;
      prev = look.equips[item.type] ?? null;
      next = prev === item.id ? null : item.id;
    } else return;
    const put = (l: Look, value: number | null): Look => {
      if (key === "background") return { ...l, background: value };
      const equips = { ...l.equips };
      if (value === null) delete equips[key];
      else equips[key] = value;
      return { ...l, equips };
    };
    const current = (l: Look) => (key === "background" ? l.background : (l.equips[key] ?? null));
    // 실패하면 그 칸만, 그 사이 다른 클릭이 바꾸지 않았을 때만 되돌린다
    const revert = () => setLook((l) => (current(l) === next ? put(l, prev) : l));
    setLook((l) => put(l, next));
    startTransition(async () => {
      try {
        const result = await equipItem(String(item.id), next !== null);
        if (!result.ok) revert();
        setNotice({ ...result, at: Date.now() });
      } catch {
        revert();
        setNotice({ ok: false, message: CLOSET_ERRORS.failed, at: Date.now() });
      }
    });
  };

  const layers = avatarLayers(character, {
    hat: art(look.equips.hat),
    clothes: art(look.equips.clothes),
    accessory: art(look.equips.accessory),
  });
  const isOn = (item: ClosetItem) => (item.type === "background" ? look.background === item.id : isAvatarSlot(item.type) && look.equips[item.type] === item.id);

  const card = (item: ClosetItem, arts: string[]) => {
    const on = isOn(item);
    return (
      <li key={item.id}>
        <button
          type="button"
          onClick={() => choose(item)}
          aria-pressed={on}
          className={`flex w-full flex-col items-center rounded-xl border-2 p-2 text-sm ${on ? "border-yellow-400 bg-yellow-50 font-bold" : "border-line bg-surface hover:bg-bg"}`}
          data-closet-item={item.name}
        >
          <PixelLayers arts={arts} size={56} />
          <span className="mt-1">
            {on && "✓ "}
            {item.name}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      {notice && (
        <p role={notice.ok ? "status" : "alert"} className={`sticky top-0 z-10 rounded-xl border px-4 py-3 font-semibold ${notice.ok ? "border-green-300 bg-green-50 text-green-800" : "border-red-300 bg-red-50 text-red-700"}`} data-equip-result={notice.ok ? "ok" : "error"}>
          {notice.message}
        </p>
      )}
      <Miniroom background={art(look.background) ?? null} avatar={layers} nickname={nickname} height={240} />

      <section aria-labelledby="closet-avatar">
        <h2 id="closet-avatar" className="text-lg font-bold">
          👕 아바타 꾸미기
        </h2>
        {avatar.length === 0 ? (
          <p className="mt-1 text-ink-soft">아직 아바타 아이템이 없어요. 상점에서 모자·옷·소품을 사 보세요.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-soft">모자·옷·소품을 하나씩 입을 수 있어요. 입은 걸 한 번 더 누르면 벗어요.</p>
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">{avatar.map((i) => card(i, avatarLayers(character, { [i.type]: i.art })))}</ul>
          </>
        )}
      </section>

      <section aria-labelledby="closet-background">
        <h2 id="closet-background" className="text-lg font-bold">
          🖼 내 배경
        </h2>
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">{backgrounds.map((i) => card(i, [i.art]))}</ul>
      </section>

      {furniture.length > 0 && (
        <section aria-labelledby="closet-furniture">
          <h2 id="closet-furniture" className="text-lg font-bold">
            🪑 가구
          </h2>
          <p className="mt-1 text-sm text-ink-soft">가구는 내 블로그의 우리 집에 놓아요.</p>
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {furniture.map((i) => (
              <li key={i.id} className="flex flex-col items-center rounded-xl border border-line bg-surface p-2 text-sm" data-closet-furniture={i.name}>
                <PixelLayers arts={[i.art]} size={56} />
                <span className="mt-1">{i.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
