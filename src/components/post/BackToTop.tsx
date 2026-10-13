"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  window.addEventListener("resize", onChange);
  return () => {
    window.removeEventListener("scroll", onChange);
    window.removeEventListener("resize", onChange);
  };
}

/** 화면 한 장(최소 600px)보다 아래로 내려 읽고 있으면 보인다 */
const scrolledDown = () => window.scrollY > Math.max(600, window.innerHeight);

/** 맨 위로 [↑] (글 읽기 편의): 긴 글을 내려 읽으면 오른쪽 아래에 뜬다. 휴대폰 아래 탭은 CSS가 피한다. */
export function BackToTop() {
  const shown = useSyncExternalStore(subscribe, scrolledDown, () => false);
  if (!shown) return null;
  const top = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    // 버튼이 사라져도 키보드 초점이 길을 잃지 않게 글 제목(tabIndex=-1)으로
    document.querySelector<HTMLElement>("h1[tabindex]")?.focus({ preventScroll: true });
  };
  return (
    <button type="button" className="to-top" onClick={top} aria-label="맨 위로" data-to-top>
      <span aria-hidden="true">↑</span>
    </button>
  );
}
