"use client";

import { useEffect, useState } from "react";
import { formatDateTime, fullDateTime, nextRelativeChange, relativeTime } from "@/lib/time";

type Props = {
  date: Date | string;
  /** 상대 시각(`12분 전`) 대신 `2026.10.14 14:05` 로 */
  absolute?: boolean;
  /** 마우스를 올렸을 때 초까지 (오류 기록처럼 같은 분에 여러 번 생기는 곳) */
  seconds?: boolean;
  className?: string;
};

/** 블로그 공통 시각 표시: 한국 시간, 분까지. 마우스를 올리면 전체 시각. 상대 시각은 바뀔 때마다 저절로 새로 고친다. */
export function Time({ date, absolute = false, seconds = false, className }: Props) {
  const at = typeof date === "string" ? new Date(date) : date;
  const ms = at.getTime();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    if (absolute) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = new Date();
      setNow(current);
      const wait = nextRelativeChange(new Date(ms), current);
      if (wait !== null) timer = setTimeout(tick, wait + 50);
    };
    tick();
    return () => clearTimeout(timer);
  }, [absolute, ms]);

  const text = absolute ? formatDateTime(at) : relativeTime(at, now ?? new Date());
  return (
    <time dateTime={at.toISOString()} title={fullDateTime(at, { seconds })} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
