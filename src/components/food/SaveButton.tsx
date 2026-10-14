"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toggleSavedPlace } from "@/app/food/saved-actions";
import type { FoodPlace } from "@/lib/food";
import { loginHref } from "@/lib/safe-next";

/** 식당 카드의 [☆ 가고 싶어요] / [⭐ 가고 싶은 곳]. 누르면 바로 바꿔 보여 주고 서버 결과로 맞춘다 */
export function SaveButton({ place, saved }: { place: FoodPlace; saved: boolean }) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(saved);
  const [shown, flip] = useOptimistic(current, (s) => !s);
  const [notice, setNotice] = useState<"login" | "full" | null>(null);

  if (notice === "login") {
    return (
      <p className="text-sm text-ink-soft" data-food-save-login>
        <Link href={loginHref("/food")} className="inline-flex min-h-11 items-center font-semibold text-accent underline">
          로그인
        </Link>
        하면 가고 싶은 곳에 담을 수 있어요
      </p>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        className={`btn ${shown ? "btn-current" : ""}`}
        aria-pressed={shown}
        aria-label={shown ? `${place.name} 가고 싶은 곳에서 빼기` : `${place.name} 가고 싶은 곳에 담기`}
        disabled={pending}
        data-food-save
        onClick={() =>
          startTransition(async () => {
            flip(undefined);
            const result = await toggleSavedPlace(place);
            if ("saved" in result) {
              setCurrent(result.saved);
              setNotice(null);
            } else if (result.error === "login" || result.error === "full") {
              setNotice(result.error);
            }
          })
        }
      >
        {shown ? "⭐ 가고 싶은 곳" : "☆ 가고 싶어요"}
      </button>
      {notice === "full" && <span className="text-sm text-ink-soft">200곳까지 담을 수 있어요</span>}
    </span>
  );
}
