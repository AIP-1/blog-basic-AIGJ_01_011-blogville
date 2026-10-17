"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * 첫 마을 환영 (TOWN-01): 가입 직후 블로그의 🚪 밖으로(`/town?welcome=1`)로 나왔을 때 한 번만.
 * 보여 준 직후 주소에서 `?welcome`을 지워 새로고침해도 다시 뜨지 않는다. 광장 개편: 종이 쪽지 모양과 [✏️ 첫 글 쓰기].
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
      className="px-box px-float absolute bottom-14 left-1/2 z-20 w-[min(34rem,calc(100%-1.5rem))] -translate-x-1/2 p-4"
      data-town-welcome
    >
      <div className="flex items-start gap-2">
        <p className="flex-1">
          🎉 <strong>{nickname}</strong>님, 마을에 처음 나왔어요! 글을 쓰면 뒤에 있는 <strong>내 집</strong> 창에 불이 켜지고, 이웃들도 광장에서 내 새 글을
          봐요. 왼쪽 위 <strong>☰ 메뉴</strong>의 텔레포트로 즐겨찾기한 이웃 집에 바로 갈 수 있어요.
        </p>
        <button type="button" className="px-btn px-btn--quiet px-btn--sm shrink-0" aria-label="환영 닫기" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2.5 p-0.5">
        <Link href="/write" className="px-btn px-btn--primary">
          ✏️ 첫 글 쓰기
        </Link>
        <button type="button" className="px-btn" onClick={() => setOpen(false)}>
          마을 둘러보기
        </button>
      </div>
    </section>
  );
}
