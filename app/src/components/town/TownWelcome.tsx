"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * 첫 마을 환영 (TOWN-01): 가입 직후 블로그의 🚪 밖으로(`/town?welcome=1`)로 나왔을 때 한 번만.
 * 보여 준 직후 주소에서 `?welcome`을 지워 새로고침해도 다시 뜨지 않는다.
 */
export function TownWelcome({ nickname, show }: { nickname: string; show: boolean }) {
  // 처음 그릴 때만 정한다
  const [open, setOpen] = useState(show);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    // history.replaceState만 쓰면 서버 액션(⭐ 등)으로 다시 그릴 때 Next가 옛 주소(?welcome)를 되살린다.
    // 라우터로 바꾸면 화면은 다시 그려도 이 창(상태)과 서 있던 자리(startKey)는 그대로다
    const url = new URL(window.location.href);
    url.searchParams.delete("welcome");
    router.replace(url.pathname + url.search, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 한 번만 지운다
  }, []);
  if (!open) return null;
  return (
    <section
      aria-label="마을 환영"
      className="absolute bottom-14 left-1/2 flex w-[min(34rem,calc(100%-1.5rem))] -translate-x-1/2 items-start gap-2 rounded-2xl border border-[#f4c430] bg-white/95 p-4 text-[#3b2a20] shadow-lg"
      data-town-welcome
    >
      <p className="flex-1">
        🎉 <strong>{nickname}</strong>님, 마을에 처음 나왔어요! 뒤에 있는 <strong>내 집</strong>에 다시 들어가면 글을 쓸 수 있어요. 왼쪽 위{" "}
        <strong>☰ 메뉴</strong>의 텔레포트로 즐겨찾기한 이웃 집에 바로 갈 수 있고, 프로필·알림·친구 목록도 볼 수 있어요.
      </p>
      <button type="button" className="btn btn-ghost min-w-11 px-2" aria-label="환영 닫기" onClick={() => setOpen(false)}>
        ✕
      </button>
    </section>
  );
}
