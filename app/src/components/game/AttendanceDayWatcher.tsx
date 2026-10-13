"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { todayKST } from "@/lib/kst";

/**
 * 화면을 연 채 한국 시간 0시를 넘기면 (GAME-04): 주소를 옮기거나 탭을 다시 볼 때 날짜가 바뀌었으면
 * 화면을 서버에서 다시 그려 헤더가 그날 출석을 기록하게 한다.
 */
/** `day`: 서버가 헤더를 그린 한국 날짜 */
export function AttendanceDayWatcher({ day: rendered }: { day: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const day = useRef(rendered);
  useEffect(() => {
    const check = () => {
      const now = todayKST();
      if (now === day.current) return;
      day.current = now;
      router.refresh();
    };
    check();
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [pathname, router]);
  return null;
}
