"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toggleBookmark } from "@/app/bookmarks/actions";

type State = { bookmarked: boolean; count: number };

/** 글 상세의 [🔖 스크랩 N] (specs/059-report-bookmarks). 누르면 바로 바꿔 보여 주고, 서버가 다시 그린 값으로 맞춘다. 방문자에게는 로그인 링크 */
export function BookmarkButton({ postId, bookmarked, count, canBookmark, loginHref }: State & { postId: number; canBookmark: boolean; loginHref: string }) {
  const [pending, startTransition] = useTransition();
  const [shown, flip] = useOptimistic<State, void>({ bookmarked, count }, (s) => ({ bookmarked: !s.bookmarked, count: s.count + (s.bookmarked ? -1 : 1) }));
  if (!canBookmark) {
    return (
      <p className="text-sm text-ink-soft" data-bookmark-login>
        <Link href={loginHref} className="inline-flex min-h-11 items-center font-semibold text-accent underline">
          로그인
        </Link>
        하면 스크랩할 수 있어요
      </p>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        className={`btn ${shown.bookmarked ? "btn-current" : ""}`}
        aria-pressed={shown.bookmarked}
        disabled={pending}
        data-bookmark
        onClick={() =>
          startTransition(async () => {
            flip();
            await toggleBookmark(String(postId));
          })
        }
      >
        🔖 {shown.bookmarked ? "스크랩함" : "스크랩"} {shown.count}
      </button>
      {shown.bookmarked && (
        <Link href="/bookmarks" className="inline-flex min-h-11 items-center px-1 text-sm text-ink-soft underline">
          내 스크랩
        </Link>
      )}
    </span>
  );
}
