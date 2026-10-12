"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { openNotification } from "@/app/notifications/actions";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { FavoriteButton } from "@/components/feed/FavoriteButton";
import { PixelLayers } from "@/components/game/PixelLayers";
import { formatNumber } from "@/lib/game";
import { lotFront } from "@/lib/town/layout";
import type { TownSpot } from "@/lib/town/structures";
import type { HudMember, TownHouse } from "@/server/town";

type Panel = "menu" | "profile" | "notifications" | "teleport" | "friends" | "mailbox";

const TITLES: Record<Panel, string> = {
  menu: "메뉴",
  profile: "👤 내 프로필",
  notifications: "🔔 알림",
  teleport: "✨ 텔레포트",
  friends: "👫 친구 목록",
  mailbox: "📮 우체통",
};

/** 게임 캔버스에 순간 이동을 알린다 (TOWN-02) */
function teleport(spot: { x: number; y: number }) {
  document.querySelector("[data-town] canvas")?.dispatchEvent(new CustomEvent("bv-teleport", { detail: { x: spot.x, y: spot.y } }));
}

/**
 * ☰ 마을 메뉴 (TOWN-12, specs/039-town-menu): 마을 왼쪽 위 버튼과 창 하나. 마을에는 헤더 막대가 없어
 * 내 프로필·알림·텔레포트·친구 목록과 내 정보·관리자·로그아웃을 여기에 둔다. 방문자는 텔레포트와 로그인만.
 * 창이 열려 있으면(`dialog[open]`) 게임은 키보드를 쓰지 않는다. Esc나 [✕]로 닫고 [‹]로 메뉴에 돌아온다.
 * `phone`이면 휴대폰 아래 탭의 ☰ 메뉴 화면(`/town?menu=1`, specs/040-phone-tabs): 게임이 없어 늘 펼친 채 페이지에 놓이고,
 * 텔레포트와 ✨ 없이 내 프로필·알림·친구 목록·바로 가기만 보인다.
 */
export function TownHud({
  hud,
  admin,
  userId,
  unread,
  spots,
  houses = [],
  phone = false,
}: {
  hud: HudMember | null;
  admin: boolean;
  userId: string | null;
  unread: string | null;
  spots: { places: TownSpot[]; houses: TownSpot[] };
  /** 우체통 창에 보일 집들 (TOWN-13) */
  houses?: TownHouse[];
  phone?: boolean;
}) {
  const [panel, setPanel] = useState<Panel | null>(phone ? "menu" : null);
  // 지금 연 우체통의 집 (자리 번호)
  const [mailLot, setMailLot] = useState<number | null>(null);
  const mailHouse = mailLot === null ? undefined : houses.find((h) => h.lot === mailLot);
  const opener = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const titleId = useId();
  // 창을 바꿀 때만 제목으로 초점을 옮긴다. 휴대폰 메뉴 화면은 처음 열 때 초점을 빼앗지 않는다
  const shown = useRef<Panel | null>(panel);

  // 게임(우체통)에서 연 창은 닫으면 초점을 게임에 돌려준다. ☰에 두면 다음 Space가 메뉴를 다시 연다
  const fromGame = useRef(false);
  const refocus = () => {
    if (!fromGame.current) opener.current?.focus();
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };
  const close = () => {
    setPanel(null);
    refocus();
  };

  useEffect(() => {
    const changed = shown.current !== panel;
    shown.current = panel;
    if (!panel) return;
    if (changed) dialog.current?.querySelector<HTMLElement>("[data-panel-focus]")?.focus();
    if (phone) return;
    const onKey = (event: KeyboardEvent) => {
      // 레벨업 팝업 같은 모달이 열려 있으면 그 창이 Esc를 받는다
      if (event.key !== "Escape" || document.querySelector("dialog[open]:modal")) return;
      event.preventDefault();
      setPanel(null);
      refocus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, phone]);

  // 게임에서 우체통 앞 Space·클릭 (TOWN-13)
  useEffect(() => {
    if (phone) return;
    const onMailbox = (event: Event) => {
      setMailLot((event as CustomEvent<{ lot: number }>).detail.lot);
      fromGame.current = true;
      setPanel("mailbox");
    };
    window.addEventListener("bv-mailbox", onMailbox);
    return () => window.removeEventListener("bv-mailbox", onMailbox);
  }, [phone]);

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

  /** 최근 알림 5개 (☰ 🔔 알림과 내 우체통이 같이 쓴다) */
  const notificationList = (hud: HudMember) => (
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
  );

  /** 친구의 집이 마을에 서 있으면 그 텔레포트 자리 */
  const houseOf = (slug: string) => (phone ? undefined : spots.houses.find((s) => s.enabled && s.slug === slug));

  const Box = phone ? "section" : "dialog";
  return (
    <>
      {!phone && (
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
            onClick={() => {
          fromGame.current = false;
          if (panel) close();
          else setPanel("menu");
        }}
            data-town-menu
          >
            ☰ 메뉴
            {unread && (
              <span className="rounded-full bg-[#e74c3c] px-1.5 text-xs text-white" aria-label={`안 읽은 알림 ${unread}`}>
                {unread}
              </span>
            )}
          </button>
        </>
      )}

      {panel && (
        <Box
          ref={dialog as never}
          open={phone ? undefined : true}
          aria-labelledby={titleId}
          className={
            phone
              ? "mx-auto w-full max-w-md rounded-2xl border border-line bg-surface p-4 text-ink"
              : "absolute left-3 top-16 m-0 max-h-[calc(100%-5rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-line bg-surface p-4 text-ink shadow-xl"
          }
          data-town-panel={panel}
        >
          <div className="mb-3 flex items-center gap-1">
            {panel !== "menu" && (
              <button type="button" className="btn btn-ghost min-w-11 px-2" aria-label="메뉴로" onClick={() => setPanel("menu")}>
                ‹
              </button>
            )}
            <h2 id={titleId} className="flex-1 text-lg font-bold" tabIndex={-1} data-panel-focus>
              {panel === "mailbox" && mailHouse ? (mailHouse.mine ? "📮 내 우체통" : `📮 ${mailHouse.nickname}님의 우체통`) : TITLES[panel]}
            </h2>
            {!phone && (
              <button type="button" className="btn btn-ghost min-w-11 px-2" aria-label="닫기" onClick={close}>
                ✕
              </button>
            )}
          </div>

          {panel === "menu" && hud && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {tile("profile", "👤 내 프로필", `Lv.${hud.level} · 🪙 ${formatNumber(hud.coin)}`)}
                {tile("notifications", "🔔 알림", unread ? `안 읽은 알림 ${unread}개` : "새 알림 없음")}
                {!phone && tile("teleport", "✨ 텔레포트", "상점·이웃집 앞으로")}
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
                <Link href="/farm" className="btn btn-ghost">
                  🐮 동물 농장
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

          {panel === "notifications" && hud && notificationList(hud)}

          {panel === "mailbox" && mailHouse?.mine && hud && notificationList(hud)}
          {panel === "mailbox" && mailHouse && !mailHouse.mine && (
            <div className="space-y-3" data-mailbox={mailHouse.slug}>
              <p className="break-words text-sm font-semibold">{mailHouse.blogTitle}의 새 글</p>
              {mailHouse.recentPosts.length === 0 ? (
                <p className="text-ink-soft">아직 공개 글이 없어요.</p>
              ) : (
                <ul className="grid gap-1" aria-label="새 글">
                  {mailHouse.recentPosts.map((post) => (
                    <li key={post.id}>
                      <Link href={`/@${mailHouse.slug}/${post.id}`} className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2 text-sm hover:bg-ink/5">
                        <span aria-hidden="true">✉️</span>
                        <span className="min-w-0 break-words">{post.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <Link href={`/@${mailHouse.slug}`} className="btn">
                  🏠 집에 들어가기
                </Link>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setPanel(null);
                    teleport(lotFront(mailHouse.lot));
                  }}
                >
                  ✨ 집 앞으로
                </button>
              </div>
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
        </Box>
      )}
    </>
  );
}
