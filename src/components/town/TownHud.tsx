"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { openNotification } from "@/app/notifications/actions";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { FavoriteButton } from "@/components/feed/FavoriteButton";
import { PixelLayers } from "@/components/game/PixelLayers";
import { formatNumber } from "@/lib/game";
import type { TownSpot } from "@/lib/town/structures";
import type { HudMember } from "@/server/town";

type Panel = "menu" | "profile" | "notifications" | "teleport" | "friends";

const TITLES: Record<Panel, string> = {
  menu: "메뉴",
  profile: "👤 내 프로필",
  notifications: "🔔 알림",
  teleport: "✨ 텔레포트",
  friends: "👫 친구 목록",
};

/** 게임 캔버스에 순간 이동을 알린다 (TOWN-02) */
function teleport(spot: { x: number; y: number }) {
  document.querySelector("[data-town] canvas")?.dispatchEvent(new CustomEvent("bv-teleport", { detail: { x: spot.x, y: spot.y } }));
}

/**
 * ☰ 마을 메뉴 (TOWN-12, specs/039-town-menu): 마을 왼쪽 위 버튼과 창 하나. 마을에는 헤더 막대가 없어
 * 내 프로필·알림·텔레포트·친구 목록과 내 정보·관리자·로그아웃을 여기에 둔다. 방문자는 텔레포트와 로그인만.
 * 창이 열려 있으면(`dialog[open]`) 게임은 키보드를 쓰지 않는다. Esc나 [✕]로 닫고 [‹]로 메뉴에 돌아온다.
 */
export function TownHud({
  hud,
  admin,
  userId,
  unread,
  spots,
}: {
  hud: HudMember | null;
  admin: boolean;
  userId: string | null;
  unread: string | null;
  spots: { places: TownSpot[]; houses: TownSpot[] };
}) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const close = () => {
    setPanel(null);
    opener.current?.focus();
  };

  useEffect(() => {
    if (!panel) return;
    dialog.current?.querySelector<HTMLElement>("[data-panel-focus]")?.focus();
    const onKey = (event: KeyboardEvent) => {
      // 레벨업 팝업 같은 모달이 열려 있으면 그 창이 Esc를 받는다
      if (event.key !== "Escape" || document.querySelector("dialog[open]:modal")) return;
      event.preventDefault();
      setPanel(null);
      opener.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  const go = (spot: TownSpot) => {
    if (!spot.enabled) return;
    setPanel(null);
    teleport(spot);
  };

  const tile = (to: Panel, title: string, sub: string) => (
    <button type="button" className="flex min-h-20 flex-col items-start justify-center rounded-xl border border-line bg-bg p-3 text-left hover:bg-ink/5" onClick={() => setPanel(to)}>
      <span className="font-bold">{title}</span>
      <span className="text-sm text-ink-soft">{sub}</span>
    </button>
  );

  /** 친구의 집이 마을에 서 있으면 그 텔레포트 자리 */
  const houseOf = (slug: string) => spots.houses.find((s) => s.enabled && s.slug === slug);

  return (
    <>
      {/* 화면 위 가운데 로고 (TOWN-01) */}
      <Link
        href={userId ? "/town" : "/"}
        className="absolute left-1/2 top-2 flex min-h-11 -translate-x-1/2 items-center px-2 text-xl font-extrabold text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.45)]"
      >
        Blogville
      </Link>
      <button
        ref={opener}
        type="button"
        className="absolute left-3 top-3 inline-flex min-h-11 min-w-11 items-center gap-1 rounded-xl bg-white/90 px-3 font-bold text-[#3b2a20] shadow"
        aria-haspopup="dialog"
        aria-expanded={panel !== null}
        onClick={() => (panel ? close() : setPanel("menu"))}
        data-town-menu
      >
        ☰ 메뉴
        {unread && (
          <span className="rounded-full bg-[#e74c3c] px-1.5 text-xs text-white" aria-label={`안 읽은 알림 ${unread}`}>
            {unread}
          </span>
        )}
      </button>

      {panel && (
        <dialog
          ref={dialog}
          open
          aria-labelledby="town-panel-title"
          className="absolute left-3 top-16 m-0 max-h-[calc(100%-5rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-line bg-surface p-4 text-ink shadow-xl"
          data-town-panel={panel}
        >
          <div className="mb-3 flex items-center gap-1">
            {panel !== "menu" && (
              <button type="button" className="btn btn-ghost min-w-11 px-2" aria-label="메뉴로" onClick={() => setPanel("menu")}>
                ‹
              </button>
            )}
            <h2 id="town-panel-title" className="flex-1 text-lg font-bold" tabIndex={-1} data-panel-focus>
              {TITLES[panel]}
            </h2>
            <button type="button" className="btn btn-ghost min-w-11 px-2" aria-label="닫기" onClick={close}>
              ✕
            </button>
          </div>

          {panel === "menu" && hud && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {tile("profile", "👤 내 프로필", `Lv.${hud.level} · 🪙 ${formatNumber(hud.coin)}`)}
                {tile("notifications", "🔔 알림", unread ? `안 읽은 알림 ${unread}개` : "새 알림 없음")}
                {tile("teleport", "✨ 텔레포트", "상점·이웃집 앞으로")}
                {tile("friends", "👫 친구 목록", `이웃 ${hud.neighborTotal}명`)}
              </div>
              {/* 마을에는 헤더가 없어 바로 가기 링크를 둔다 (걷지 않고, 화면 낭독기로도) */}
              <nav aria-label="바로 가기" className="mt-3 flex flex-wrap gap-1">
                <Link href="/write" className="btn btn-ghost">
                  ✏️ 글쓰기
                </Link>
                <Link href="/feed" className="btn btn-ghost">
                  📋 마을 소식
                </Link>
                <Link href="/shop" className="btn btn-ghost">
                  🏪 상점
                </Link>
                <Link href="/attendance" className="btn btn-ghost">
                  📮 출석
                </Link>
              </nav>
              <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-line pt-3">
                <Link href="/settings/account" className="btn btn-ghost">
                  ⚙️ 내 정보
                </Link>
                {admin && (
                  <Link href="/admin" className="btn btn-ghost">
                    👑 관리자
                  </Link>
                )}
                {userId && <SignOutButton userId={userId} />}
              </div>
            </>
          )}
          {panel === "menu" && !hud && (
            <div className="grid gap-2">
              {tile("teleport", "✨ 텔레포트", "상점·이웃집 앞으로")}
              <Link href="/feed" className="flex min-h-14 items-center rounded-xl border border-line bg-bg p-3 font-bold hover:bg-ink/5">
                📋 마을 소식
              </Link>
              <Link href="/" className="flex min-h-14 items-center rounded-xl border border-line bg-bg p-3 font-bold hover:bg-ink/5">
                🔑 로그인하고 내 집 만들기
              </Link>
            </div>
          )}

          {panel === "profile" && hud && (
            <div className="space-y-3" data-town-profile>
              <div className="flex items-center gap-3">
                <PixelLayers arts={hud.layers} size={56} />
                <div className="min-w-0">
                  <p className="font-bold">{hud.nickname}</p>
                  <p className="break-words text-sm text-ink-soft">📖 {hud.blog.title}</p>
                </div>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-ink-soft">레벨</dt>
                <dd className="font-bold">Lv.{hud.level}</dd>
                <dt className="text-ink-soft">🪙 코인</dt>
                <dd className="font-bold" data-town-coin>
                  {formatNumber(hud.coin)}
                </dd>
                <dt className="text-ink-soft">✨ 경험치</dt>
                <dd data-town-exp>{hud.exp.isMax ? "최고 레벨" : `${formatNumber(hud.exp.current)} / ${formatNumber(hud.exp.needed)}`}</dd>
              </dl>
              <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
                <div className="h-full bg-accent" style={{ width: `${Math.round((hud.exp.isMax ? 1 : hud.exp.ratio) * 100)}%` }} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/@${hud.blog.slug}`} className="btn">
                  🏠 내 블로그
                </Link>
                <Link href="/closet" className="btn">
                  🎨 꾸미기
                </Link>
                <Link href="/wallet" className="btn">
                  📒 지갑
                </Link>
              </div>
            </div>
          )}

          {panel === "notifications" && hud && (
            <div className="space-y-2">
              {hud.notifications.length === 0 ? (
                <p className="text-ink-soft">아직 알림이 없어요.</p>
              ) : (
                <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line" aria-label="최근 알림">
                  {hud.notifications.map((n) => (
                    <li key={n.id}>
                      <form action={openNotification}>
                        <input type="hidden" name="id" value={n.id} />
                        <button
                          type="submit"
                          className={`flex min-h-11 w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-ink/5 ${n.read ? "" : "bg-[#fff3d6] font-bold"}`}
                          data-notification={n.read ? "read" : "unread"}
                        >
                          <span>
                            {!n.read && <span className="sr-only">안 읽음, </span>}
                            {n.text}
                          </span>
                          <span className="text-xs font-normal text-ink-soft">{n.time}</span>
                        </button>
                      </form>
                    </li>
                  ))}
                </ol>
              )}
              <Link href="/notifications" className="btn btn-ghost">
                알림함 전체 보기 ›
              </Link>
            </div>
          )}

          {panel === "teleport" && (
            <div className="space-y-3">
              <section aria-labelledby="tp-places">
                <h3 id="tp-places" className="mb-1 text-sm font-bold text-ink-soft">
                  마을
                </h3>
                <ul className="grid gap-1">
                  {spots.places.map((s) => (
                    <li key={s.id}>
                      <button type="button" className="btn w-full justify-start" onClick={() => go(s)}>
                        {s.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
              <section aria-labelledby="tp-houses">
                <h3 id="tp-houses" className="mb-1 text-sm font-bold text-ink-soft">
                  집 (내 집 + 즐겨찾기 이웃 10자리)
                </h3>
                <ul className="grid gap-1" aria-label="집">
                  {spots.houses.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="btn h-auto min-h-11 w-full flex-col items-start py-1.5 text-left disabled:opacity-60"
                        disabled={!s.enabled}
                        onClick={() => go(s)}
                        data-spot={s.id}
                      >
                        <span>{s.label}</span>
                        {s.sub && <span className="text-xs font-normal text-ink-soft">{s.sub}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}

          {panel === "friends" && hud && (
            <div className="space-y-2">
              <p className="text-sm text-ink-soft">⭐ 즐겨찾는 이웃 {hud.favorites}/10명의 집이 마을에 서요.</p>
              {hud.neighbors.length === 0 ? (
                <p className="text-ink-soft">아직 이웃이 없어요. 블로그에서 [+ 이웃 추가]를 눌러 보세요.</p>
              ) : (
                <ul className="divide-y divide-line" aria-label="친구 목록">
                  {hud.neighbors.map((n) => {
                    const home = n.isFavorite ? houseOf(n.slug) : undefined;
                    return (
                      <li key={n.userId} className="flex flex-wrap items-center gap-1 py-1.5" data-friend={n.nickname}>
                        <Link href={`/@${n.slug}`} className="min-w-0 flex-1 px-1 hover:underline">
                          <span className="block truncate font-semibold">{n.nickname}</span>
                          <span className="block truncate text-xs text-ink-soft">{n.blogTitle}</span>
                        </Link>
                        {home && (
                          <button type="button" className="btn btn-ghost min-w-11 px-2" aria-label={`${n.nickname}의 집으로 텔레포트`} onClick={() => go(home)}>
                            ✨
                          </button>
                        )}
                        <FavoriteButton followeeId={n.userId} on={n.isFavorite} name={n.nickname} notice={n.isNotice} favorites={hud.favorites} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </dialog>
      )}
    </>
  );
}
