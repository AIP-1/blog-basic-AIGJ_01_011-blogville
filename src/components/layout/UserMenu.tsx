"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { formatNumber } from "@/lib/game";

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
        onClick={() => setOpen((v) => !v)}
        className={`flex size-11 items-center justify-center overflow-hidden rounded-full border bg-bg transition ${open ? "border-accent ring-2 ring-accent/30" : "border-line hover:border-ink-soft"}`}
        data-user-menu-button
      >
        {avatar}
      </button>
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
