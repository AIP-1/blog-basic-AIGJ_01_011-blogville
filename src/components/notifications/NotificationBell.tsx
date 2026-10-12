"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { unreadBadge } from "@/lib/notifications";

/**
 * 안 읽은 알림 수 (GAME-08, 헤더 🔔·휴대폰 아래 탭). 처음 숫자는 서버가 그린다. 헤더(레이아웃)는 화면을 옮겨도
 * 다시 그려지지 않으므로 주소가 바뀔 때마다 안 읽은 수를 새로 받는다.
 * `unread`는 서버가 헤더를 다시 그릴 때마다(Server Action 뒤 등) 새 객체로 온다. 숫자가 전과 같아도
 * 그때의 서버 값으로 맞추고, 받는 중이던 옛 숫자는 버린다.
 */
export function useUnreadCount(unread: { count: number }): number {
  const pathname = usePathname();
  const [count, setCount] = useState(unread.count);
  const [seen, setSeen] = useState(unread);
  if (seen !== unread) {
    setSeen(unread);
    setCount(unread.count);
  }
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let alive = true;
    fetch("/api/notifications/unread", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { count?: unknown } | null) => {
        if (alive && typeof data?.count === "number") setCount(data.count);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname, unread]);
  return count;
}

/** 헤더 🔔 (GAME-08) */
export function NotificationBell({ unread }: { unread: { count: number } }) {
  const count = useUnreadCount(unread);
  const badge = unreadBadge(count);
  return (
    <Link href="/notifications" className="btn btn-ghost relative px-2" aria-label={badge ? `알림, 안 읽은 알림 ${badge}개` : "알림"}>
      🔔<span className="hidden sm:inline">알림</span>
      {badge && (
        <span
          className="absolute right-0 top-0.5 min-w-5 rounded-full bg-danger px-1 text-center text-xs leading-5 font-bold text-white"
          aria-hidden="true"
          data-unread
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
