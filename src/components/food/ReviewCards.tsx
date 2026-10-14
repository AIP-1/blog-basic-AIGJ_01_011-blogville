"use client";

import { useState } from "react";
import type { FoodReview } from "@/lib/food";

/** 📝 블로그 후기 카드: 대표 사진 배너 + 협찬/내돈내산 표시. [협찬 글 숨기기]로 걸러 본다 */
export function ReviewCards({ reviews }: { reviews: FoodReview[] }) {
  const [hideSponsored, setHide] = useState(false);
  const sponsored = reviews.filter((r) => r.sponsor === "sponsored").length;
  const self = reviews.filter((r) => r.sponsor === "self").length;
  const shown = hideSponsored ? reviews.filter((r) => r.sponsor !== "sponsored") : reviews;
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">💰 협찬 표시 {sponsored}편</span>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">🧾 내돈내산 {self}편</span>
        {sponsored > 0 && (
          <label className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-sm text-ink-soft">
            <input type="checkbox" checked={hideSponsored} onChange={(e) => setHide(e.target.checked)} data-food-hide-sponsored />
            협찬 글 숨기기
          </label>
        )}
      </div>
      <ol className="mt-3 grid gap-3 sm:grid-cols-2" data-food-reviews>
        {shown.map((r) => (
          <li key={r.url} data-food-review={r.sponsor ?? "none"}>
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="group block h-full overflow-hidden rounded-xl border border-line bg-surface hover:border-accent">
              <div className="relative aspect-[16/9] bg-bg">
                {r.image ? (
                  // 블로그 사진은 그 사이트에서 바로 불러온다 (주소 노출을 막으려고 referrer는 보내지 않는다)
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl opacity-40" aria-hidden>
                    🍽
                  </div>
                )}
                {r.sponsor === "sponsored" && (
                  <span className="absolute left-2 top-2 rounded-md bg-amber-500 px-2 py-0.5 text-xs font-bold text-white shadow" data-food-sponsor-badge>
                    💰 협찬
                  </span>
                )}
                {r.sponsor === "self" && (
                  <span className="absolute left-2 top-2 rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white shadow">🧾 내돈내산</span>
                )}
              </div>
              <div className="p-3">
                <p className="line-clamp-2 font-semibold group-hover:underline">{r.title}</p>
                {r.summary && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{r.summary}</p>}
                <p className="mt-1.5 text-xs text-ink-soft">
                  {r.blogger}
                  {r.date && ` · ${r.date}`}
                </p>
              </div>
            </a>
          </li>
        ))}
      </ol>
      {hideSponsored && shown.length === 0 && <p className="mt-3 text-center text-sm text-ink-soft">협찬 표시가 없는 후기가 없어요.</p>}
      <p className="mt-3 text-xs text-ink-soft">
        💰 협찬은 글에 &ldquo;협찬·원고료·제공받아·체험단&rdquo; 같은 문구나 체험단 배너가 있는 글이에요. 표시 없이 쓴 협찬 글은 못 찾을 수 있어요.
      </p>
    </div>
  );
}
