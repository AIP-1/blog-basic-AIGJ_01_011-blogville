"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { REWARD_RULES } from "@/lib/game";

/**
 * 새 글 발행 직후 글 상세 맨 위의 노란 안내 (POST-01). 글쓰기 보상을 받았는지도 알린다 (GAME-05).
 * 그린 뒤 주소에서 `?new`를 지워 새로고침하면 사라진다.
 *
 * 뒤로·앞으로 가기는 Next가 저장해 둔 화면(`?new=1`로 그린 것)을 다시 꺼내 이 안내도 다시 붙는다.
 * 그래서 보일지는 처음 붙을 때 라우터 주소에 `?new`가 있는지로 정하고, 그 뒤로는 바꾸지 않는다.
 *
 * 안내 아래 [🏮 광장에서 내 초롱 켜기](plaza-upgrade-2 C2): 내 집 앞에서 시작해 창에 불이 켜지는 순간을 본다
 * (`/town?from=home&lit=1`). 안내 글자(보상 줄)는 그대로 두고 링크는 옆에 따로 둔다.
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
    <div className="mx-auto mb-4 flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-stretch">
      <p role="status" className="notice-yellow flex-1 rounded-2xl p-4 font-semibold">
        🎉 글을 발행했어요!{" "}
        {rewarded
          ? `✨ 경험치 ${REWARD_RULES.post.exp} · 🪙 ${REWARD_RULES.post.coin} 코인을 받았어요`
          : `(비공개 글, 짧은 글, 또는 오늘 글쓰기 보상 ${REWARD_RULES.post.dailyLimit}번을 다 받아서 보상은 없어요)`}
      </p>
      <Link href="/town?from=home&lit=1" className="btn btn-primary shrink-0 justify-center self-stretch rounded-2xl px-5 sm:self-auto" data-publish-lantern>
        🏮 광장에서 내 초롱 켜기
      </Link>
    </div>
  );
}
