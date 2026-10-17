"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "@/app/(auth)/actions";
import { FavoriteButton } from "@/components/feed/FavoriteButton";
import { InviteButton, LotsPanel } from "@/components/town/LotsPanel";
import { PixelLayers } from "@/components/game/PixelLayers";
import { clearDraft } from "@/lib/draft";
import { formatNumber } from "@/lib/game";
import { unreadBadge } from "@/lib/notifications";
import { emitTown, teleportTo } from "@/lib/town/events";
import { lotFront, START_POS, type Point } from "@/lib/town/layout";
import type { PlazaNews } from "@/lib/town/plaza";
import type { Sky } from "@/lib/town/sky";
import type { TownSpot } from "@/lib/town/structures";
import type { HudMember, TownHouse } from "@/server/town";
import { NOTICE_SLUG } from "@/lib/names";
import { supportHref } from "@/lib/support-rules";
import { MailboxNote } from "./MailboxNote";
import { NotificationList } from "./NotificationList";
import { PlaceSign } from "./PlaceSign";
import { PlazaDrawer } from "./PlazaDrawer";
import { usePhoneWidth } from "./TownGame";
import { TownThemeToggle } from "./TownThemeToggle";
import { useLiveUnread } from "./useLiveUnread";
import { WriteButton } from "./WriteButton";

type Panel = "menu" | "profile" | "notifications" | "teleport" | "friends" | "mailbox" | "lots";

const TITLES: Record<Panel, string> = {
  menu: "메뉴",
  profile: "👤 내 프로필",
  notifications: "🔔 알림",
  teleport: "✨ 텔레포트",
  friends: "👫 친구 목록",
  mailbox: "📮 우체통",
  lots: "🏡 이웃 집 자리",
};

/** 지갑 칩의 경험치 칸 수 */
const EXP_CELLS = 8;

/** 종이 쪽지 위 작은 칸(메뉴 타일·텔레포트 줄)의 먹색 노치 테두리 (키트 .px-box와 같은 모양, 바탕만 다르게) */
const NOTCH = "shadow-[0_-2px_0_0_var(--kit-ink),0_2px_0_0_var(--kit-ink),-2px_0_0_0_var(--kit-ink),2px_0_0_0_var(--kit-ink)]";
const TILE = `flex min-h-[4.5rem] flex-col items-start justify-center gap-0.5 bg-(--kit-paper-2) px-3 py-2 text-left ${NOTCH} hover:bg-(--kit-paper-hover) active:translate-y-0.5`;
const ROW = `flex min-h-11 w-full items-center bg-(--kit-paper-2) px-3 py-1.5 text-left font-semibold ${NOTCH} hover:bg-(--kit-paper-hover) disabled:cursor-not-allowed disabled:opacity-60`;
const SMALL = "px-btn px-btn--quiet px-btn--sm";

/**
 * 우체통 창 머리의 방문 수 (B3, blog_visits 오늘·어제): 이웃 집은 '오늘 12명 · 어제 9명이 다녀갔어요', 내 집은 '오늘 우리 집 방문 7 (어제 12)'.
 * 이름표 아래 설명 줄은 없앴으므로(1.26) 숫자는 창 안에만 둔다. 시험 훅 `data-visits`(오늘,어제).
 */
function VisitLine({ house }: { house: TownHouse }) {
  // 주인이 👣 방문자 위젯을 숨긴 이웃 집은 서버가 방문 수를 보내지 않는다
  if (house.visitsToday === undefined) return null;
  const today = house.visitsToday ?? 0;
  const yesterday = house.visitsYesterday ?? 0;
  return (
    <p className="text-sm font-semibold" data-visits={`${today},${yesterday}`}>
      <span aria-hidden="true">👣 </span>
      {house.mine ? `오늘 우리 집 방문 ${today} (어제 ${yesterday})` : `오늘 ${today}명 · 어제 ${yesterday}명이 다녀갔어요`}
    </p>
  );
}

/** ☰ 계정 줄의 로그아웃: 이 브라우저에 남은 그 회원의 임시 글도 지운다 (POST-08, SignOutButton과 같다) */
function TownSignOut({ userId }: { userId: string }) {
  return (
    <form action={signOut}>
      <button type="submit" className={SMALL} onClick={() => clearDraft(userId)}>
        로그아웃
      </button>
    </form>
  );
}

/**
 * 마을 HUD (TOWN-12, specs/039-town-menu, 광장 개편 "나무 간판과 종이 쪽지"):
 *  왼쪽 위 간판 묶음  [☰ 메뉴 | Blogville] [Lv·경험치 8칸·🪙 지갑 칩 → 👤 내 프로필] [✏️ 글쓰기 + 오늘 글 보상 창문 3칸]
 *  위 가운데 장소 간판  지금 구역과 한국 시각 (친구 마을이면 그 마을 이름과 [🏠 내 마을로])
 *  오른쪽 위 서랍      광장 소식: 이웃 새 글·오늘 할 일
 * ☰ 창에는 내 프로필·알림·텔레포트·친구 목록과 바로 가기, 내 정보·관리자·로그아웃. 방문자는 텔레포트와 로그인만.
 * 창이 열려 있으면(`dialog[open]`) 게임은 키보드를 쓰지 않는다. Esc나 [✕]로 닫고 [‹]로 메뉴에 돌아온다. 마을(캔버스)을 눌러도 닫히고,
 * 그 클릭은 게임이 평소대로 받는다(걷기·다른 우체통). 열고 닫을 때 `bv-panel`.
 * 안 읽은 알림은 1분마다·탭으로 돌아올 때 다시 읽어 ☰ 숫자를 바꾸고 `bv-mail`을 보낸다 (`useLiveUnread`, 휴대폰 폭에서는 쉰다).
 * `phone`이면 휴대폰 아래 탭의 ☰ 메뉴 화면(`/town?menu=1`, specs/040-phone-tabs): 게임이 없어 늘 펼친 채 페이지에 놓이고,
 * 텔레포트와 ✨ 없이 내 프로필·알림·친구 목록·바로 가기만 보인다.
 */
export function TownHud({
  hud,
  admin,
  userId,
  spots,
  houses = [],
  phone = false,
  host = null,
  news = null,
  notice = null,
  sky = null,
  start = START_POS,
}: {
  hud: HudMember | null;
  admin: boolean;
  userId: string | null;
  spots: { places: TownSpot[]; houses: TownSpot[] };
  /** 우체통 창에 보일 집들 (TOWN-13) */
  houses?: TownHouse[];
  phone?: boolean;
  /** 친구 마을 구경이면 그 마을 주인 (TOWN-15): 위 가운데에 마을 이름과 [🏠 내 마을로] */
  host?: { nickname: string; slug: string } | null;
  /** 광장 소식 서랍의 글 (휴대폰 메뉴 화면은 없음) */
  news?: PlazaNews | null;
  /** 사이트 공지 띠 (ADM-04): 마을에서는 띠 대신 서랍 맨 위 한 줄 */
  notice?: { text: string; link: string | null } | null;
  /** 하늘 고정 (`?sky=`): 장소 간판 시계의 이름도 그것으로 */
  sky?: Sky | null;
  /** 시작 자리: 게임이 구역을 알리기 전 장소 간판 */
  start?: Point;
}) {
  const [panel, setPanel] = useState<Panel | null>(phone ? "menu" : null);
  // 지금 연 우체통의 집 (자리 번호)
  const [mailLot, setMailLot] = useState<number | null>(null);
  const mailHouse = mailLot === null ? undefined : houses.find((h) => h.lot === mailLot);
  // 🏡 이웃 집 자리에서 고르는 중인 자리 (TOWN-18)
  const [pickLot, setPickLot] = useState<number | null>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const wallet = useRef<HTMLButtonElement>(null);
  // 창을 연 버튼 (☰ 또는 지갑 칩): 닫으면 초점을 돌려준다
  const returnTo = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLElement>(null);
  const titleId = useId();
  // 창을 바꿀 때만 제목으로 초점을 옮긴다. 휴대폰 메뉴 화면은 처음 열 때 초점을 빼앗지 않는다
  const shown = useRef<Panel | null>(panel);
  // 휴대폰 폭에서는 이 HUD가 CSS로 숨어 있고 게임도 없으니 알림 수를 다시 읽지 않는다
  const onPhone = usePhoneWidth();
  const unreadCount = useLiveUnread(hud?.unread ?? 0, hud !== null && !phone && !onPhone);
  const unread = unreadBadge(unreadCount);

  // 게임(우체통)에서 연 창은 닫으면 초점을 게임에 돌려준다. ☰에 두면 다음 Space가 메뉴를 다시 연다
  const fromGame = useRef(false);
  const refocus = () => {
    if (!fromGame.current) (returnTo.current ?? opener.current)?.focus();
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };
  const close = () => {
    setPanel(null);
    refocus();
  };
  const toggle = (from: HTMLElement | null, to: Panel) => {
    fromGame.current = false;
    returnTo.current = from;
    if (panel === to || (to === "menu" && panel)) close();
    else setPanel(to);
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
    // 마을(캔버스)을 누르면 창을 닫는다. 캔버스보다 먼저(capture) 닫아 두면 같은 클릭으로 게임이 연 우체통(`bv-mailbox`)이 이긴다.
    // 초점은 ☰에 돌려주지 않고 놓는다: ☰에 두면 다음 Space가 메뉴를 다시 연다
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || !(event.target instanceof HTMLCanvasElement) || !event.target.closest("[data-town]")) return;
      setPanel(null);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [panel, phone]);

  // 창이 열리고 닫힐 때 게임에 알린다 (열면 멀리서 누른 건물에 걸어가 들어가기를 그만둔다)
  const isOpen = panel !== null;
  const announced = useRef(isOpen);
  useEffect(() => {
    if (phone || announced.current === isOpen) return;
    announced.current = isOpen;
    emitTown("bv-panel", { open: isOpen });
  }, [isOpen, phone]);

  // 게임에서 우체통 앞 Space·클릭 (TOWN-13)
  useEffect(() => {
    if (phone) return;
    const onMailbox = (event: Event) => {
      setMailLot((event as CustomEvent<{ lot: number }>).detail.lot);
      fromGame.current = true;
      setPanel("mailbox");
    };
    // 내 마을의 빈 집터 앞 Space·클릭 (TOWN-18): 그 자리 고르기 창
    const onLots = (event: Event) => {
      setPickLot((event as CustomEvent<{ lot: number }>).detail.lot);
      fromGame.current = true;
      setPanel("lots");
    };
    window.addEventListener("bv-mailbox", onMailbox);
    window.addEventListener("bv-lots", onLots);
    return () => {
      window.removeEventListener("bv-mailbox", onMailbox);
      window.removeEventListener("bv-lots", onLots);
    };
  }, [phone]);

  const go = (spot: TownSpot) => {
    if (!spot.enabled) return;
    setPanel(null);
    teleportTo(spot);
  };

  const tile = (to: Panel, title: string, sub: string) => (
    <button type="button" className={TILE} onClick={() => setPanel(to)}>
      <span className="font-bold">{title}</span>
      <span className="text-sm text-(--kit-ink-soft)">{sub}</span>
    </button>
  );

  /** 친구의 집이 마을에 서 있으면 그 텔레포트 자리 */
  const houseOf = (slug: string) => (phone ? undefined : spots.houses.find((s) => s.enabled && s.slug === slug));

  const expCells = hud ? (hud.exp.isMax ? EXP_CELLS : Math.min(EXP_CELLS, Math.floor(hud.exp.ratio * EXP_CELLS))) : 0;
  const Box = phone ? "section" : "dialog";
  return (
    <>
      {!phone && (
        <>
          {/* 왼쪽 위 간판 묶음 (TOWN-01·12): 캔버스 클릭을 막지 않게 묶음 틈은 비워 둔다. `data-town-hud-row`: 입구 안내는 이 아래에 뜬다 */}
          <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-start gap-2.5" data-town-hud-row>
            <div className="px-plank px-float pointer-events-auto flex min-h-11 items-stretch">
              <button
                ref={opener}
                type="button"
                className="inline-flex min-h-11 min-w-11 items-center gap-1.5 px-3 font-bold"
                aria-haspopup="dialog"
                aria-expanded={panel !== null}
                onClick={(event) => toggle(event.currentTarget, "menu")}
                data-town-menu
              >
                ☰ 메뉴
                {unread && (
                  <span className="px-chip" data-tone="alert" aria-label={`안 읽은 알림 ${unread}`}>
                    {unread}
                  </span>
                )}
              </button>
              {/* 친구 마을에서는 장소 간판이 마을 이름을 보이므로 로고를 접는다 (간판이 묶음과 겹치지 않게) */}
              <span className={`flex items-stretch ${host ? "hidden" : ""}`}>
                <span className="w-0.5 bg-(--kit-wood-edge)" aria-hidden="true" />
                {/* 로고 (TOWN-01): 회원은 내 마을, 방문자는 첫 화면 */}
                <Link href={userId ? "/town" : "/"} className="px-font-2x flex min-h-11 items-center px-3">
                  Blogville
                </Link>
              </span>
            </div>
            {hud && (
              <button
                ref={wallet}
                type="button"
                className="px-box px-float pointer-events-auto flex min-h-11 flex-col items-start justify-center gap-1 px-2.5 py-1 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-(--kit-ink)"
                aria-haspopup="dialog"
                aria-expanded={panel === "profile"}
                // 이름은 보이는 글자(Lv·🪙 코인)로 시작한다 (말로 누르기, WCAG 2.5.3)
                aria-label={`Lv.${hud.level} 🪙 ${formatNumber(hud.coin)}, 내 프로필 열기, ${hud.exp.isMax ? "최고 레벨" : `다음 레벨까지 경험치 ${formatNumber(hud.exp.current)}/${formatNumber(hud.exp.needed)}`}`}
                onClick={(event) => toggle(event.currentTarget, "profile")}
                data-town-wallet
              >
                <span className="flex items-center gap-2">
                  <span className="px-chip" data-tone="accent">
                    Lv.{hud.level}
                  </span>
                  <span className="px-font whitespace-nowrap">🪙 {formatNumber(hud.coin)}</span>
                </span>
                <span className="px-cells text-(--accent)" aria-hidden="true">
                  {Array.from({ length: EXP_CELLS }, (_, i) => (
                    <span key={i} data-on={i < expCells ? "" : undefined} />
                  ))}
                </span>
              </button>
            )}
            <WriteButton rewards={hud ? hud.postRewardsToday : null} className="px-float pointer-events-auto" />
          </div>

          {/* 위 가운데 장소 간판: 내 마을은 왼쪽 묶음과 겹치지 않는 넓은 화면에서만, 친구 마을은 늘 (좁은 화면은 묶음 아래 둘째 줄) */}
          <div
            className={`pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 ${host ? "max-xl:left-3 max-xl:top-[4.25rem] max-xl:translate-x-0" : "max-xl:hidden"}`}
            data-town-hud-row
          >
            <div className="pointer-events-auto">
              {/* 구역은 처음 자리에서 잡고 그 뒤로는 게임(bv-zone)을 따른다. 환영을 주소에서 지워 시작 자리가 바뀌어도 캐릭터는 그대로라 다시 잡지 않는다 */}
              <PlaceSign start={start} sky={sky} host={host} />
            </div>
          </div>

          {news && (
            <PlazaDrawer
              news={news}
              tasks={hud?.tasks ?? null}
              places={spots.places}
              notice={notice}
              member={hud !== null}
              host={host}
              onTeleport={(spot) => {
                setPanel(null);
                teleportTo(spot);
              }}
            />
          )}
        </>
      )}

      {panel && (
        <Box
          ref={dialog as never}
          open={phone ? undefined : true}
          aria-labelledby={titleId}
          className={
            phone
              ? "px-box mx-auto w-full max-w-md p-4"
              : // 친구 마을의 좁은 화면(xl 미만)은 장소 간판이 둘째 줄이라 그 아래에서 연다
                `px-box px-float absolute left-3 top-[4.5rem] z-30 m-0 max-h-[calc(100%-6rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto border-0 p-4 ${host ? "max-xl:top-[7.75rem] max-xl:max-h-[calc(100%-9.25rem)]" : ""}`
          }
          data-town-panel={panel}
        >
          <div className="mb-3 flex items-center gap-1">
            {panel !== "menu" && (
              <button type="button" className={SMALL} aria-label="메뉴로" onClick={() => setPanel("menu")}>
                ‹
              </button>
            )}
            <h2 id={titleId} className="flex-1 text-lg font-bold" tabIndex={-1} data-panel-focus>
              {panel === "mailbox" && mailHouse
                ? mailHouse.mine
                  ? "📮 내 우체통"
                  : mailHouse.suggested
                    ? `🏡 ${mailHouse.nickname}님이 이사 올 수 있어요`
                    : `📮 ${mailHouse.nickname}님의 우체통`
                : TITLES[panel]}
            </h2>
            {!phone && (
              <button type="button" className={SMALL} aria-label="닫기" onClick={close}>
                ✕
              </button>
            )}
          </div>

          {panel === "menu" && hud && (
            <>
              <div className="grid grid-cols-2 gap-2.5 p-0.5">
                {tile("profile", "👤 내 프로필", `Lv.${hud.level} · 🪙 ${formatNumber(hud.coin)}`)}
                {tile("notifications", "🔔 알림", unread ? `안 읽은 알림 ${unread}개` : "새 알림 없음")}
                {!phone && tile("teleport", "✨ 텔레포트", "상점·이웃집 앞으로")}
                {tile("friends", "👫 친구 목록", `이웃 ${hud.neighborTotal}명`)}
                {!phone && !host && (
                  <button
                    type="button"
                    className={TILE}
                    onClick={() => {
                      setPickLot(null);
                      setPanel("lots");
                    }}
                  >
                    <span className="font-bold">🏡 이웃 집 자리</span>
                    <span className="text-sm text-(--kit-ink-soft)">{`이웃 집 ${houses.filter((h) => h.lot > 0 && !h.suggested).length}/10채`}</span>
                  </button>
                )}
              </div>
              {/* 마을에는 헤더가 없어 바로 가기 링크를 둔다 (걷지 않고, 화면 낭독기로도). 3×3 칸, 이모지는 그대로 보인다 */}
              <nav aria-label="바로 가기" className="mt-3 grid grid-cols-3 gap-1 border-t-2 border-(--kit-paper-2) pt-3">
                {(
                  [
                    ["/write", "✏️", "글쓰기"],
                    ["/feed", "📋", "마을 소식"],
                    ["/popular", "🔥", "인기 글"],
                    ["/shop", "🏪", "상점"],
                    ["/clothes", "👗", "옷가게"],
                    ["/salon", "💇", "미용실"],
                    ["/attendance", "📮", "출석"],
                    ["/farm", "🐮", "동물 농장"],
                    ["/fishing", "🎣", "낚시터"],
                  ] as const
                ).map(([href, icon, label]) => (
                  <Link key={href} href={href} className="flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-center text-[13px] font-semibold hover:bg-(--kit-paper-2)">
                    {/* 이모지 뒤 띄어쓰기는 이모지 칸 안에 둔다 (글자는 '✏️ 글쓰기' 그대로) */}
                    <span className="text-xl leading-none">{`${icon} `}</span>
                    {label}
                  </Link>
                ))}
              </nav>
              <div className="mt-3 flex flex-wrap items-center gap-1 border-t-2 border-(--kit-paper-2) pt-3">
                <Link href="/settings/account" className={SMALL}>
                  ⚙️ 내 정보
                </Link>
                <Link href="/bookmarks" className={SMALL}>
                  🔖 내 스크랩
                </Link>
                {/* 마을에는 아래 막대(업데이트 소식·버그·문의·화면 밝기)가 없어 여기에 둔다 (SUP-01) */}
                <Link href="/updates" className={SMALL}>
                  🆕 업데이트 소식
                </Link>
                <Link href={supportHref("/town")} className={SMALL}>
                  🐞 버그·문의
                </Link>
                <TownThemeToggle className={SMALL} />
                {admin && (
                  <Link href="/admin" className={SMALL}>
                    👑 관리자
                  </Link>
                )}
                {userId && <TownSignOut userId={userId} />}
              </div>
            </>
          )}
          {panel === "menu" && !hud && (
            <div className="grid gap-2.5 p-0.5">
              {tile("teleport", "✨ 텔레포트", "상점·이웃집 앞으로")}
              <Link href="/feed" className={`${ROW} min-h-14`}>
                📋 마을 소식
              </Link>
              <Link href="/" className={`${ROW} min-h-14`}>
                🔑 로그인하고 내 집 만들기
              </Link>
            </div>
          )}

          {panel === "profile" && hud && (
            <div className="space-y-3" data-town-profile>
              <div className="flex items-center gap-3">
                <span className={`grid size-16 shrink-0 place-items-center bg-(--kit-paper-2) ${NOTCH}`}>
                  <PixelLayers arts={hud.layers} size={56} />
                </span>
                <div className="min-w-0">
                  <p className="font-bold">{hud.nickname}</p>
                  <p className="break-words text-sm text-(--kit-ink-soft)">📖 {hud.blog.title}</p>
                </div>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-(--kit-ink-soft)">레벨</dt>
                <dd className="font-bold">Lv.{hud.level}</dd>
                <dt className="text-(--kit-ink-soft)">🪙 코인</dt>
                <dd className="font-bold" data-town-coin>
                  {formatNumber(hud.coin)}
                </dd>
                <dt className="text-(--kit-ink-soft)">✨ 경험치</dt>
                <dd data-town-exp>{hud.exp.isMax ? "최고 레벨" : `${formatNumber(hud.exp.current)} / ${formatNumber(hud.exp.needed)}`}</dd>
              </dl>
              <span className="px-bar mx-0.5" aria-hidden="true">
                <span style={{ width: `${Math.round((hud.exp.isMax ? 1 : hud.exp.ratio) * 100)}%` }} />
              </span>
              <div className="flex flex-wrap gap-2.5 pt-1">
                <Link href={`/@${hud.blog.slug}`} className="px-btn px-btn--sm">
                  🏠 내 블로그
                </Link>
                <Link href="/closet" className="px-btn px-btn--sm">
                  🎨 꾸미기
                </Link>
                <Link href="/wallet" className="px-btn px-btn--sm">
                  📒 지갑
                </Link>
              </div>
            </div>
          )}

          {panel === "notifications" && hud && <NotificationList notifications={hud.notifications} />}

          {panel === "mailbox" && mailHouse?.mine && hud && (
            <div className="space-y-2">
              <VisitLine house={mailHouse} />
              <NotificationList notifications={hud.notifications} />
            </div>
          )}
          {panel === "mailbox" && mailHouse && !mailHouse.mine && (
            <div className="space-y-3" data-mailbox={mailHouse.slug} data-mailbox-suggested={mailHouse.suggested ? "1" : undefined}>
              {mailHouse.suggested ? (
                <p className="text-sm text-(--kit-ink-soft)">
                  빈 집터에 잠깐 들른 이웃이에요. 모시면 ⭐ 즐겨찾는 이웃이 되고 이 자리에 집이 서요.
                </p>
              ) : (
                <VisitLine house={mailHouse} />
              )}
              <p className="break-words text-sm font-semibold">{mailHouse.blogTitle}의 새 글</p>
              {mailHouse.recentPosts.length === 0 ? (
                <p className="text-(--kit-ink-soft)">아직 공개 글이 없어요.</p>
              ) : (
                <ul className="grid gap-2 p-0.5" aria-label="새 글">
                  {mailHouse.recentPosts.map((post) => (
                    <li key={post.id}>
                      <Link href={`/@${mailHouse.slug}/${post.id}`} className={`${ROW} gap-2 text-sm ${post.read ? "text-(--kit-ink-soft)" : ""}`} data-read={post.read ? "1" : "0"}>
                        <span aria-hidden="true">{post.read ? "✓" : "✉️"}</span>
                        {post.read && <span className="sr-only">읽은 글, </span>}
                        <span className="min-w-0 break-words font-(family-name:--blog-serif) font-bold">{post.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {mailHouse.suggested ? (
                <div className="flex flex-wrap gap-2.5 pt-1">
                  {hud && !host && <InviteButton house={mailHouse} />}
                  <Link href={`/@${mailHouse.slug}`} className="px-btn px-btn--sm">
                    📖 블로그 구경
                  </Link>
                </div>
              ) : (
                <>
                  {/* 쪽지(방명록)는 회원만, 공지 블로그에는 없다 */}
                  {hud && mailHouse.slug !== NOTICE_SLUG && <MailboxNote key={mailHouse.slug} slug={mailHouse.slug} lot={mailHouse.lot} />}
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    <Link href={`/@${mailHouse.slug}`} className="px-btn px-btn--sm">
                      🏠 집에 들어가기
                    </Link>
                    {hud && mailHouse.slug !== host?.slug && (
                      <Link href={`/town/${mailHouse.slug}`} className="px-btn px-btn--sm">
                        🏘 {mailHouse.nickname}님의 마을 구경
                      </Link>
                    )}
                    <button
                      type="button"
                      className="px-btn px-btn--sm"
                      onClick={() => {
                        setPanel(null);
                        teleportTo(lotFront(mailHouse.lot));
                      }}
                    >
                      ✨ 집 앞으로
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {panel === "teleport" && (
            <div className="space-y-3">
              <section aria-labelledby="tp-places">
                <h3 id="tp-places" className="mb-1.5 text-sm font-bold text-(--kit-ink-soft)">
                  마을
                </h3>
                <ul className="grid gap-2 p-0.5">
                  {spots.places.map((s) => (
                    <li key={s.id}>
                      <button type="button" className={ROW} onClick={() => go(s)}>
                        {s.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
              <section aria-labelledby="tp-houses">
                <h3 id="tp-houses" className="mb-1.5 text-sm font-bold text-(--kit-ink-soft)">
                  {host ? `집 (${host.nickname}님 집 + 즐겨찾기 이웃 10자리)` : "집 (내 집 + 즐겨찾기 이웃 10자리)"}
                </h3>
                <ul className="grid gap-2 p-0.5" aria-label="집">
                  {spots.houses.map((s) => (
                    <li key={s.id}>
                      <button type="button" className={`${ROW} flex-col items-start`} disabled={!s.enabled} onClick={() => go(s)} data-spot={s.id}>
                        <span>{s.label}</span>
                        {s.sub && <span className="text-xs font-normal text-(--kit-ink-soft)">{s.sub}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}

          {panel === "lots" && hud && !host && <LotsPanel houses={houses} spots={spots.houses} picked={pickLot} onPick={setPickLot} onTeleport={go} />}

          {panel === "friends" && hud && (
            <div className="space-y-2">
              <p className="text-sm text-(--kit-ink-soft)">⭐ 즐겨찾는 이웃 {hud.favorites}/10명의 집이 마을에 서요.</p>
              {hud.neighbors.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-(--kit-ink-soft)">아직 이웃이 없어요. 블로그에서 [+ 이웃 추가]를 눌러 보세요.</p>
                  <div className="flex flex-wrap gap-1">
                    <Link href="/feed" className={SMALL}>
                      📋 마을 소식에서 찾기
                    </Link>
                    <Link href="/popular" className={SMALL}>
                      🔥 인기 글에서 찾기
                    </Link>
                  </div>
                </div>
              ) : (
                <ul className="divide-y-2 divide-(--kit-paper-2)" aria-label="친구 목록">
                  {hud.neighbors.map((n) => {
                    const home = n.isFavorite ? houseOf(n.slug) : undefined;
                    return (
                      <li key={n.userId} className="flex flex-wrap items-center gap-1 py-1.5" data-friend={n.nickname}>
                        <Link href={`/@${n.slug}`} className="min-w-0 flex-1 px-1 hover:underline">
                          <span className="block truncate font-semibold">{n.nickname}</span>
                          <span className="block truncate text-xs text-(--kit-ink-soft)">{n.blogTitle}</span>
                        </Link>
                        {home && (
                          <button type="button" className={SMALL} aria-label={`${n.nickname}의 집으로 텔레포트`} onClick={() => go(home)}>
                            ✨
                          </button>
                        )}
                        {!n.isNotice && !phone && (
                          <Link href={`/town/${n.slug}`} className={SMALL} aria-label={`${n.nickname}님의 마을 구경`}>
                            🏘
                          </Link>
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
