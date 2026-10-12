"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { unreadBadge } from "@/lib/notifications";

/**
 * 헤더 🔔 (GAME-08). 처음 숫자는 서버가 그린다. 헤더(레이아웃)는 화면을 옮겨도 다시 그려지지 않으므로
 * 주소가 바뀔 때마다 안 읽은 수를 새로 받는다. 서버가 새 숫자로 다시 그리면(모두 읽음 뒤 등) 받는 중이던
 * 옛 숫자는 버리고 다시 받는다.
 */
export function NotificationBell({ initial }: { initial: number }) {
  const pathname = usePathname();
  const [count, setCount] = useState(initial);
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setCount(initial);
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
  }, [pathname, initial]);

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
