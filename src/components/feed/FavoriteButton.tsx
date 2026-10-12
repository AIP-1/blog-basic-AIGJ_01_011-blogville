"use client";

import { useEffect, useRef, useState } from "react";
import { favoriteNeighbor } from "@/app/blog/actions";

/**
 * 내 이웃 목록 줄의 ☆/⭐ (TOWN-08). 서버가 바꾼 뒤 목록이 다시 그려져 별과 순서가 바뀐다.
 * 거절(10명 넘음 등)하면 줄 아래에 문구를 보여 주고, 즐겨찾기 수가 바뀌면(다른 ⭐를 끔) 지운다. 누르는 영역은 44 × 44px.
 * 공지사항 블로그는 ⭐가 꺼져 있으면 📢만 보인다 (이미 켜 둔 ⭐는 끌 수 있다).
 * 줄이 자리를 옮기거나 📢로 바뀌어도 키보드 초점이 그 자리에 남도록, 누른 뒤 다시 그려지면 초점을 돌려준다.
 */
export function FavoriteButton({ followeeId, on, name, notice, favorites }: { followeeId: string; on: boolean; name: string; notice: boolean; favorites: number }) {
  const [error, setError] = useState<{ message: string; favorites: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const noticeMark = useRef<HTMLSpanElement>(null);
  const refocus = useRef(false);

  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    (button.current ?? noticeMark.current)?.focus();
  }, [on]);

  if (notice && !on) {
    return (
      <span
        ref={noticeMark}
        tabIndex={-1}
        title="공지사항 블로그는 즐겨찾기할 수 없어요"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
      >
        <span aria-hidden="true">📢</span>
        <span className="sr-only">공지사항 블로그는 즐겨찾기할 수 없어요</span>
      </span>
    );
  }
  return (
    <form
      action={async (formData) => {
        const result = await favoriteNeighbor(formData);
        if (result.error) {
          setError({ message: result.error, favorites });
        } else {
          setError(null);
          refocus.current = true;
        }
      }}
      className="contents"
    >
      <input type="hidden" name="followeeId" value={followeeId} />
      <button
        ref={button}
        type="submit"
        aria-pressed={on}
        aria-label={`${name} 즐겨찾기`}
        title={on ? "즐겨찾기 끄기" : "즐겨찾기"}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl hover:bg-[#fff8e1]"
      >
        {on ? "⭐" : "☆"}
      </button>
      {error && error.favorites === favorites && (
        <p
          role="alert"
          className="order-last basis-full text-sm font-semibold text-[#b71c1c]"
        >
          {error.message}
        </p>
      )}
    </form>
  );
}
