"use client";

import { useEffect } from "react";

/**
 * 새 글 발행 직후 글 상세 맨 위의 노란 안내 (POST-01). 보상(게임)이 없어 `🎉 글을 발행했어요!`만 보인다.
 * 그린 뒤 주소에서 `?new`를 지워 새로고침하면 사라진다.
 */
export function PublishNotice() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("new")) return;
    url.searchParams.delete("new");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
  return (
    <p role="status" className="notice-yellow mx-auto mb-4 max-w-3xl rounded-2xl p-4 font-semibold">
      🎉 글을 발행했어요!
    </p>
  );
}
