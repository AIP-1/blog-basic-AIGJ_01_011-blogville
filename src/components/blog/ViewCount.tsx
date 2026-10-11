"use client";

import { startTransition, useEffect, useState } from "react";
import { recordPostView } from "@/app/blog/actions";

/**
 * 글 상세의 `👀 N` (POST-06). 주인이 아니면 화면이 열릴 때 한 번 기록하고 돌려받은 숫자로 바꾼다.
 * 서버 렌더는 조회수를 바꾸지 않아서 링크 미리 불러오기로는 세지 않는다.
 */
export function ViewCount({ postId, initial, record }: { postId: number; initial: number; record: boolean }) {
  const [count, setCount] = useState(initial);
  useEffect(() => {
    if (!record) return;
    startTransition(async () => {
      const next = await recordPostView(String(postId)).catch(() => null);
      if (next !== null) setCount(next);
    });
  }, [postId, record]);
  return <span aria-label={`조회 ${count}`}>👀 {count}</span>;
}
