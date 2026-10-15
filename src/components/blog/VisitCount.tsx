"use client";

import { useEffect, useState } from "react";
import { postVisit } from "./record-visit";
import type { VisitStats } from "@/server/stats";

const n = (value: number) => value.toLocaleString("ko-KR");

/** 블로그 홈 옆 칸 `👣 방문자` (BLOG-06). 주인이 아니면 열릴 때 한 번 기록하고 숫자를 바꾼다. */
export function VisitCount({ blogId, initial, record }: { blogId: number; initial: VisitStats; record: boolean }) {
  const [stats, setStats] = useState(initial);
  useEffect(() => {
    if (!record) return;
    let live = true;
    postVisit<{ stats: VisitStats | null }>({ blogId }).then((res) => {
      if (live && res?.stats) setStats(res.stats);
    });
    return () => {
      live = false;
    };
  }, [blogId, record]);
  return (
    <dl className="grid grid-cols-3 gap-2 text-center">
      {(
        [
          ["오늘", stats.today],
          ["어제", stats.yesterday],
          ["전체", stats.total],
        ] as const
      ).map(([label, value]) => (
        <div key={label} className="rounded-lg bg-bg py-2">
          <dt className="text-xs text-ink-soft">{label}</dt>
          <dd className="font-bold" data-visit={label}>
            {n(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
