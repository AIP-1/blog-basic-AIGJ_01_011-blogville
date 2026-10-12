"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { REWARD_RULES } from "@/lib/game";

/**
 * 새 글 발행 직후 글 상세 맨 위의 노란 안내 (POST-01). 글쓰기 보상을 받았는지도 알린다 (GAME-05).
 * 그린 뒤 주소에서 `?new`를 지워 새로고침하면 사라진다.
 *
 * 뒤로·앞으로 가기는 Next가 저장해 둔 화면(`?new=1`로 그린 것)을 다시 꺼내 이 안내도 다시 붙는다.
 * 그래서 보일지는 처음 붙을 때 라우터 주소에 `?new`가 있는지로 정하고, 그 뒤로는 바꾸지 않는다.
 */
export function PublishNotice({ rewarded }: { rewarded: boolean }) {
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
      🎉 글을 발행했어요!{" "}
      {rewarded
        ? `✨ 경험치 ${REWARD_RULES.post.exp} · 🪙 ${REWARD_RULES.post.coin} 코인을 받았어요`
        : `(비공개 글, 짧은 글, 또는 오늘 글쓰기 보상 ${REWARD_RULES.post.dailyLimit}번을 다 받아서 보상은 없어요)`}
    </p>
  );
}
