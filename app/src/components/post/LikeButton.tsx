"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toggleLike } from "@/app/blog/actions";

type State = { liked: boolean; count: number };

/** 글 상세의 [♡ 공감 N] (SOC-03). 누르면 바로 바꿔 보여 주고, 서버가 다시 그린 값으로 맞춘다. */
export function LikeButton({ postId, liked, count, canLike, loginHref }: State & { postId: number; canLike: boolean; loginHref: string }) {
  const [pending, startTransition] = useTransition();
  const [shown, flip] = useOptimistic<State, void>({ liked, count }, (s) => ({ liked: !s.liked, count: s.count + (s.liked ? -1 : 1) }));
  return (
    <div className="mt-8 flex flex-col items-center gap-1">
      <button
        type="button"
        className={`like-btn ${shown.liked ? "is-liked" : ""}`}
        aria-pressed={shown.liked}
        aria-describedby={canLike ? undefined : "like-login"}
        disabled={!canLike || pending}
        onClick={() =>
          startTransition(async () => {
            flip();
            await toggleLike(String(postId));
          })
        }
      >
        {shown.liked ? "♥" : "♡"} 공감 {shown.count}
      </button>
      {!canLike && (
        <>
          <p className="text-sm text-ink-soft" data-like-login>
            <Link href={loginHref} className="inline-flex min-h-11 items-center font-semibold text-accent underline">
              로그인
            </Link>
            하면 공감할 수 있어요
          </p>
          {/* 44px 링크가 끼면 버튼 설명이 '로그인 하면'으로 끊겨 읽혀 설명은 따로 둔다 */}
          <span id="like-login" hidden>
            로그인하면 공감할 수 있어요
          </span>
        </>
      )}
    </div>
  );
}
