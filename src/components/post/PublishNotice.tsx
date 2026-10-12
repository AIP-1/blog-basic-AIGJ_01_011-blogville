"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * 새 글 발행 직후 글 상세 맨 위의 노란 안내 (POST-01). 보상(게임)이 없어 `🎉 글을 발행했어요!`만 보인다.
 * 그린 뒤 주소에서 `?new`를 지워 새로고침하면 사라진다.
 *
 * 뒤로·앞으로 가기는 Next가 저장해 둔 화면(`?new=1`로 그린 것)을 다시 꺼내 이 안내도 다시 붙는다.
 * 그래서 보일지는 처음 붙을 때 라우터 주소에 `?new`가 있는지로 정하고, 그 뒤로는 바꾸지 않는다.
 */
export function PublishNotice() {
  const params = useSearchParams();
  const [show] = useState(() => params.has("new"));
  useEffect(() => {
    // 처음 열 때는 Next가 history를 감싸기 전에 이 효과가 먼저 돌아, 한 틈 미뤄 감싼 replaceState를 쓴다.
    // 그래야 Next의 기록 상태가 지워지지 않고 라우터 주소에서도 ?new가 빠진다.
    const timer = setTimeout(() => {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("new")) return;
      url.searchParams.delete("new");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    });
    return () => clearTimeout(timer);
  }, []);
  if (!show) return null;
  return (
    <p role="status" className="notice-yellow mx-auto mb-4 max-w-3xl rounded-2xl p-4 font-semibold">
      🎉 글을 발행했어요!
    </p>
  );
}
