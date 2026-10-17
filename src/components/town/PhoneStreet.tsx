"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PixelArtSvg } from "@/components/game/PixelArtSvg";
import { houseArt, lanternArt, litHouseArt } from "@/lib/art/town";
import { trimArt } from "@/lib/game-rooms";
import { shortName } from "@/lib/town/layout";
import type { TownHouse } from "@/server/town";
import { MailboxNote } from "./MailboxNote";

/** 띠 한 칸 (이웃 집): 서버에서 넘길 것만 */
export type StreetHouse = Pick<TownHouse, "lot" | "slug" | "nickname" | "roof" | "fresh" | "unread" | "recentPosts">;

/** 시트에 보이는 이웃 최근 글 수 */
const SHEET_POSTS = 3;

/**
 * 휴대폰 광장 이웃 띠 (plaza-upgrade-2 C5): 즐겨찾는 이웃 집 모두를 가로로 밀어 보는 한 줄. 칸마다 지붕색 작은 집(글 쓴 집은 창에 불),
 * 짧은 이름, 안 읽은 글 점. 누르면 아래에서 시트가 올라와 그 이웃의 최근 글 3편과 우체통 쪽지 넣기(MailboxNote, hud)를 보인다.
 * 시험 훅 `data-phone-street`(칸 수)·`data-street-house`·`data-phone-sheet`·`data-sheet-post`.
 */
export function PhoneStreet({ houses }: { houses: readonly StreetHouse[] }) {
  const [open, setOpen] = useState<StreetHouse | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  if (houses.length === 0) return null;
  return (
    <section aria-labelledby="plaza-street" className="space-y-2">
      <h2 id="plaza-street" className="font-bold">
        이웃 집 <span className="text-sm font-normal text-ink-soft">({houses.length})</span>
      </h2>
      <ul className="flex snap-x scroll-px-1 gap-2.5 overflow-x-auto p-1 pb-2" data-phone-street={houses.length}>
        {houses.map((h) => {
          const unread = h.unread ?? h.fresh;
          const art = trimArt(houseArt(1, h.roof));
          return (
            <li key={h.slug} className="shrink-0 snap-start">
              <button
                type="button"
                className="px-tile relative flex h-24 w-20 flex-col items-center justify-end gap-1 px-1 pb-1.5 active:translate-y-px"
                onClick={() => setOpen(h)}
                data-street-house={h.slug}
                data-lit={h.fresh ? "1" : "0"}
                aria-label={`${h.nickname}${unread ? ", 새 글 있음" : ""}`}
              >
                {unread && <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-[#c8542c] shadow-[0_0_0_2px_var(--kit-paper)]" data-street-unread aria-hidden="true" />}
                <PixelArtSvg art={h.fresh ? litHouseArt(art) : art} cell={2} className="h-auto max-w-full" />
                <span className="px-font block w-full truncate text-center">{shortName(h.nickname, 5)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <dialog
        ref={dialog}
        className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[80vh] w-full max-w-none overflow-y-auto bg-(--kit-paper) p-0 text-(--kit-ink) shadow-[0_-2px_0_0_var(--kit-ink)] backdrop:bg-black/40"
        onClose={() => setOpen(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(null);
        }}
        aria-labelledby="street-sheet-title"
        data-phone-sheet={open?.slug ?? ""}
      >
        {open && (
          <div className="mx-auto max-w-md space-y-4 px-4 pt-4 pb-6">
            <div className="flex items-center gap-2">
              <span className="inline-flex w-5 justify-center" aria-hidden="true">
                <PixelArtSvg art={lanternArt(open.fresh, "s")} cell={3} />
              </span>
              <h2 id="street-sheet-title" className="min-w-0 flex-1 truncate font-bold">
                {open.nickname}님의 집
              </h2>
              <button type="button" className="px-btn px-btn--sm" onClick={() => setOpen(null)}>
                닫기
              </button>
            </div>
            <Link href={`/@${open.slug}`} className="px-btn w-full">
              🏠 블로그 가기
            </Link>
            <section aria-labelledby="street-sheet-posts">
              <h3 id="street-sheet-posts" className="text-sm font-bold">
                최근 글
              </h3>
              {open.recentPosts.length === 0 ? (
                <p className="mt-1 text-sm text-ink-soft">아직 공개 글이 없어요.</p>
              ) : (
                <ul className="px-tile mt-2 divide-y-2 divide-line">
                  {open.recentPosts.slice(0, SHEET_POSTS).map((p) => (
                    <li key={p.id}>
                      <Link href={`/@${open.slug}/${p.id}`} className="block px-3 py-2.5" data-sheet-post>
                        <span className="line-clamp-2 font-(family-name:--blog-serif) text-[15px] leading-snug font-bold break-words">{p.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <MailboxNote slug={open.slug} lot={open.lot} />
          </div>
        )}
      </dialog>
    </section>
  );
}
