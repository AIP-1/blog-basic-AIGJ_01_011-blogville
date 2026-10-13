"use client";

import { useSyncExternalStore } from "react";
import { nextTheme, parseTheme, THEME_KEY, THEME_LABEL, type Theme } from "@/lib/theme";

// 지금 밝기는 html[data-theme]이 기준이다. 그리기 전 스크립트(THEME_BOOT_SCRIPT)가 저장된 값을 붙여 둔다.
const EVENT = "bv-theme-change";
const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
};
const readTheme = (): Theme => parseTheme(document.documentElement.dataset.theme);

/** 아래 막대의 화면 밝기 버튼 (개선 8): 기기 설정 → 어둡게 → 밝게 */
export function ThemeToggle({ className }: { className: string }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as const);

  function change() {
    const next = nextTheme(theme);
    if (next === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try {
      if (next === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <button type="button" onClick={change} className={className} aria-label={`화면 밝기: ${THEME_LABEL[theme]} (누르면 바꿔요)`} data-theme-toggle>
      <span className="truncate">{THEME_LABEL[theme]}</span>
    </button>
  );
}
