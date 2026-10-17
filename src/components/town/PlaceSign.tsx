"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { onTown } from "@/lib/town/events";
import type { Point } from "@/lib/town/layout";
import { clockText } from "@/lib/town/plaza";
import type { Sky } from "@/lib/town/sky";
import { ZONE_LABELS, zoneAt, type Zone } from "@/lib/town/zones";

// 분이 바뀔 때마다 한 번 깨운다 (1초마다 돌지 않게 다음 분 0초에 맞춘다)
const subscribeMinute = (onChange: () => void) => {
  let timer = 0;
  const arm = () => {
    timer = window.setTimeout(
      () => {
        onChange();
        arm();
      },
      60_000 - (Date.now() % 60_000) + 50,
    );
  };
  arm();
  return () => window.clearTimeout(timer);
};
const minuteNow = () => Math.floor(Date.now() / 60_000);

/** 한국 시각 시계 글자 (`밤 9:41`). 서버 그림에는 비워 두고(시각이 달라 어긋나지 않게) 브라우저가 채운다 */
function useClock(sky: Sky | null): string | null {
  const minute = useSyncExternalStore(subscribeMinute, minuteNow, () => null);
  return minute === null ? null : clockText(new Date(minute * 60_000), sky);
}

/**
 * 장소 간판 (광장 개편): 화면 위 가운데 작은 나무 간판에 지금 선 구역(게임이 보내는 `bv-zone`)과 한국 시각.
 * 친구 마을(TOWN-15)이면 구역 대신 `🏘 {닉네임}님의 마을`과 [🏠 내 마을로] (시험 훅 `data-town-host`). 1280px 미만은 왼쪽 간판 묶음 아래 둘째 줄(TownHud).
 */
export function PlaceSign({ start, sky, host = null }: { start: Point; sky: Sky | null; host?: { nickname: string; slug: string } | null }) {
  const [zone, setZone] = useState<Zone>(() => zoneAt(start));
  useEffect(() => onTown("bv-zone", (detail) => setZone(detail.zone)), []);
  const clock = useClock(sky);
  // 시계를 채우기 전에도 자리를 잡아 두어 간판 폭이 흔들리지 않게
  const time = clock ? (
    <span className="px-chip shrink-0" data-town-clock>
      {clock}
    </span>
  ) : (
    <span className="px-chip invisible shrink-0" aria-hidden="true">
      노을 12:00
    </span>
  );

  if (host) {
    // 마을 이름은 12rem에서 줄인다: 긴 닉네임도 간판이 왼쪽 간판 묶음과 겹치지 않게. 768px 미만은 시계를 접는다(펼친 서랍과 부딪히지 않게)
    return (
      <div className="px-plank px-float flex min-h-11 items-center gap-2 py-1 pl-3 pr-1" data-town-host={host.slug}>
        <span className="max-w-[min(40vw,12rem)] truncate font-bold" title={`${host.nickname}님의 마을`}>
          🏘 {host.nickname}님의 마을
        </span>
        <span className="contents max-md:hidden">{time}</span>
        <Link href="/town" className="px-btn px-btn--sm shrink-0">
          🏠 내 마을로
        </Link>
      </div>
    );
  }
  return (
    <div className="px-plank px-float flex min-h-9 items-center gap-2 py-1 pl-3 pr-1.5" data-town-place={zone}>
      <span className="px-font whitespace-nowrap">{ZONE_LABELS[zone]}</span>
      {time}
    </div>
  );
}
