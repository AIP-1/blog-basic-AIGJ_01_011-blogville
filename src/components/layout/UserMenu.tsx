"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { formatNumber } from "@/lib/game";

// 처음 온 회원에게 한 번만 "여기를 누르면 내 메뉴" 말풍선 (이 브라우저에 기억)
const HINT_KEY = "bv-my-menu-hint";
const hintListeners = new Set<() => void>();
function hintSeen(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return true;
  }
}
function markHintSeen() {
  try {
    localStorage.setItem(HINT_KEY, "1");
  } catch {}
  hintListeners.forEach((f) => f());
}
function subscribeHint(f: () => void) {
  hintListeners.add(f);
  return () => hintListeners.delete(f);
}

type Props = {
  userId: string;
  nickname: string;
  slug: string;
  isAdmin: boolean;
  level: number;
  /** 다음 레벨까지 (0~1) */
  ratio: number;
  isMax: boolean;
  coin: number;
  /** 내 캐릭터 (서버가 그린 PixelLayers) */
  avatar: React.ReactNode;
};

/**
 * 헤더 오른쪽 끝 내 캐릭터 버튼 → 내 메뉴 (네이버·티스토리·GitHub처럼 계정 일은 한곳에).
 * 맨 위에 닉네임·레벨·경험치 막대·코인, 그 아래 내 블로그·블로그 관리·내 정보·경험치 내역·상점·출석·관리자, 맨 아래 로그아웃.
 * 바깥을 누르거나 Esc, 화면을 옮기면 닫힌다. Esc로 닫으면 버튼으로 초점이 돌아온다.
 */
export function UserMenu({ userId, nickname, slug, isAdmin, level, ratio, isMax, coin, avatar }: Props) {
  const [open, setOpen] = useState(false);
  const [seenPath, setSeenPath] = useState<string | null>(null);
  const pathname = usePathname();
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  // 서버·첫 그리기에서는 본 것으로 (말풍선은 브라우저에서만)
  const seen = useSyncExternalStore(subscribeHint, hintSeen, () => true);

  // 화면을 옮기면 닫는다
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] hover:bg-bg";
  return (
    <div className="relative" ref={box}>
      <button
        ref={button}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={id}
        aria-label="내 메뉴"
        title="내 메뉴 (내 블로그·설정·로그아웃)"
        onClick={() => {
          setOpen((v) => !v);
          if (!seen) markHintSeen();
        }}
        className={`group flex min-h-11 items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 transition ${
          open ? "border-accent bg-accent/5 ring-2 ring-accent/30" : "border-line bg-surface hover:border-ink-soft hover:bg-bg"
        }`}
        data-user-menu-button
      >
        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg">{avatar}</span>
        <span className="max-w-[7rem] truncate text-sm font-semibold max-md:hidden max-lg:max-w-[5rem]">{nickname}</span>
        <svg viewBox="0 0 12 12" aria-hidden className={`size-3 shrink-0 text-ink-soft transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {!seen && !open && (
        <div role="note" className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl bg-ink p-3 text-sm text-surface shadow-lg" data-my-menu-hint>
          <span aria-hidden className="absolute -top-1.5 right-5 size-3 rotate-45 bg-ink" />
          👋 여기를 누르면 <b>내 블로그·블로그 관리·내 정보·상점·출석·로그아웃</b>이 모여 있어요.
          <button type="button" onClick={markHintSeen} className="mt-2 block min-h-9 w-full rounded-lg bg-surface/15 font-semibold hover:bg-surface/25">
            알겠어요
          </button>
        </div>
      )}
      {open && (
        <div
          id={id}
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-line bg-surface p-2 shadow-xl max-sm:fixed max-sm:inset-x-3 max-sm:top-16 max-sm:w-auto"
          data-user-menu
        >
          <Link href="/wallet" className="mb-1 flex items-center gap-3 rounded-xl bg-bg p-3 hover:bg-accent/5" aria-label={`${nickname}, Lv.${level}, 코인 ${formatNumber(coin)}: 경험치·코인 내역`}>
            <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface">{avatar}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{nickname}</span>
              <span className="block truncate text-xs text-ink-soft">@{slug}</span>
              <span className="mt-1.5 flex items-center gap-2 text-xs">
                <span className="rounded-full bg-accent/10 px-1.5 font-bold text-accent">Lv.{level}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round((isMax ? 1 : ratio) * 100)}%` }} />
                </span>
                <span className="whitespace-nowrap font-semibold">🪙 {formatNumber(coin)}</span>
              </span>
            </span>
          </Link>
          <nav aria-label="내 메뉴">
            <ul>
              <li>
                <Link href={`/@${slug}`} className={item}>
                  <span aria-hidden>🏠</span>내 블로그
                </Link>
              </li>
              <li>
                <Link href="/settings/blog" className={item}>
                  <span aria-hidden>🛠️</span>블로그 관리
                </Link>
              </li>
              <li>
                <Link href="/settings/account" className={item}>
                  <span aria-hidden>👤</span>내 정보
                </Link>
              </li>
              <li className="my-1 border-t border-line" aria-hidden />
              <li>
                <Link href="/shop" className={item}>
                  <span aria-hidden>🏪</span>마을 상점
                </Link>
              </li>
              <li>
                <Link href="/attendance" className={item}>
                  <span aria-hidden>📮</span>출석 체크
                </Link>
              </li>
              <li>
                <Link href="/wallet" className={item}>
                  <span aria-hidden>🪙</span>경험치·코인 내역
                </Link>
              </li>
              {isAdmin && (
                <li>
                  <Link href="/admin" className={item}>
                    <span aria-hidden>👑</span>관리자
                  </Link>
                </li>
              )}
            </ul>
          </nav>
          <div className="mt-1 border-t border-line pt-1 [&_button]:w-full [&_button]:justify-start [&_button]:px-3">
            <SignOutButton userId={userId} />
          </div>
        </div>
      )}
    </div>
  );
}
