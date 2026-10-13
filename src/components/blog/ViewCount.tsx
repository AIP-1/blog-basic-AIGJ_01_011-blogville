"use client";

import { startTransition, useEffect, useState } from "react";
import { recordPostView } from "@/app/blog/actions";

/**
 * 이 화면에 오기 직전 주소. 사이트 안에서 링크로 옮겨 왔으면(처음 연 문서 주소와 지금 주소가 다르면)
 * document.referrer는 처음 들어온 곳 그대로라, 우리 사이트에서 왔다고 본다.
 */
function currentReferrer(): string {
  const landing = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.name;
  if (landing && landing !== window.location.href) return `${window.location.origin}/`;
  return document.referrer;
}

/**
 * 글 상세의 `👀 N` (POST-06). 주인이 아니면 화면이 열릴 때 한 번 기록하고 돌려받은 숫자로 바꾼다.
 * 서버 렌더는 조회수를 바꾸지 않아서 링크 미리 불러오기로는 세지 않는다.
 */
export function ViewCount({ postId, initial, record }: { postId: number; initial: number; record: boolean }) {
  const [count, setCount] = useState(initial);
  useEffect(() => {
    if (!record) return;
    startTransition(async () => {
      // 어디서 왔는지(유입 경로)는 서버가 사이트 이름만 남긴다
      const next = await recordPostView(String(postId), currentReferrer()).catch(() => null);
      if (next !== null) setCount(next);
    });
  }, [postId, record]);
  return <span aria-label={`조회 ${count}`}>👀 {count}</span>;
}
