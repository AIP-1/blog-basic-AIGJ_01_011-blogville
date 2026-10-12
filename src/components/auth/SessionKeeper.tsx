"use client";

import { useEffect } from "react";

/** 이만큼 지나야 다시 묻는다 */
const EVERY_MS = 10 * 60 * 1000;
const KEY = "bv_session_kept_at";
/** 브라우저 저장소를 못 쓸 때는 이 화면에서만 센다 */
let keptHere = 0;

/**
 * [로그인 상태 유지] 세션을 쓰는 동안 다시 7일로 늘린다 (AUTH-09).
 * 서버 화면을 그릴 때는 쿠키를 바꿀 수 없어서, 화면을 열 때·탭으로 돌아올 때·열어 둔 동안
 * 세션 조회(`GET /api/auth/get-session`)를 10분에 한 번까지 불러 라이브러리가 세션과 쿠키를 늘리게 한다. 결과는 쓰지 않는다.
 */
export function SessionKeeper() {
  useEffect(() => {
    const keep = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      const recent = (last: number) => last > 0 && last <= now && now - last < EVERY_MS;
      try {
        if (recent(Number(localStorage.getItem(KEY)))) return;
        localStorage.setItem(KEY, String(now));
      } catch {
        if (recent(keptHere)) return;
      }
      keptHere = now;
      fetch("/api/auth/get-session", { credentials: "same-origin", cache: "no-store" }).catch(() => {});
    };
    keep();
    document.addEventListener("visibilitychange", keep);
    const timer = setInterval(keep, EVERY_MS);
    return () => {
      document.removeEventListener("visibilitychange", keep);
      clearInterval(timer);
    };
  }, []);
  return null;
}
