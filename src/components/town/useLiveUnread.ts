"use client";

import { useEffect, useRef, useState } from "react";
import { emitTown } from "@/lib/town/events";

/** 마을에 오래 머무는 동안 안 읽은 알림 수를 다시 읽는 간격 */
export const UNREAD_POLL_MS = 60_000;

/**
 * 광장의 안 읽은 알림 수 (광장 개편): 마을은 화면을 옮기지 않고 오래 머물러 헤더 🔔처럼 주소가 바뀔 때 다시 읽을 수 없다.
 * 1분마다(탭이 보일 때만), 그리고 탭으로 돌아올 때(visibilitychange) `/api/notifications/unread`를 다시 읽는다.
 * 있다/없다가 바뀌면 window에 `bv-mail {flag}`를 보내 게임이 내 우체통 깃발만 다시 그리게 한다(게임을 다시 만들지 않는다).
 * `initial`은 서버가 그린 값. 서버가 다시 그리면(⭐·서버 액션 뒤) 그 값으로 맞춘다.
 */
export function useLiveUnread(initial: number, enabled: boolean): number {
  const [count, setCount] = useState(initial);
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setCount(initial);
  }

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/notifications/unread", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { count?: unknown } | null) => {
          if (alive && typeof data?.count === "number") setCount(data.count);
        })
        .catch(() => {});
    };
    const timer = window.setInterval(load, UNREAD_POLL_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [enabled]);

  // 깃발은 서버가 그린 값(TownGame mailFlag)에서 시작한다. 바뀔 때만 알린다
  const flag = count > 0;
  const sent = useRef(initial > 0);
  useEffect(() => {
    if (!enabled || sent.current === flag) return;
    sent.current = flag;
    emitTown("bv-mail", { flag });
  }, [enabled, flag]);

  return count;
}
