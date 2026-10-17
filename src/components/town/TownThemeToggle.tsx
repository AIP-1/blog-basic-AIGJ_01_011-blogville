"use client";

import { useSyncExternalStore } from "react";
import { nextTheme, parseTheme, THEME_KEY, THEME_LABEL, type Theme } from "@/lib/theme";

// 아래 막대의 ThemeToggle과 같은 신호를 주고받아 한쪽에서 바꾸면 다른 쪽 글자도 따라 바뀐다
const EVENT = "bv-theme-change";
const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
};
const readTheme = (): Theme => parseTheme(document.documentElement.dataset.theme);

/**
 * ☰ 메뉴 계정 줄의 화면 밝기 버튼 (광장 개편): 마을에는 아래 막대가 없어 여기에 둔다. 기기 설정 → 어둡게 → 밝게.
 * 아래 막대 버튼과 헷갈리지 않게 `data-theme-toggle`은 달지 않는다 (dark-mode.spec이 그 버튼 하나를 센다).
 */
export function TownThemeToggle({ className }: { className: string }) {
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
    <button type="button" onClick={change} className={className} aria-label={`화면 밝기: ${THEME_LABEL[theme]} (누르면 바꿔요)`} data-town-theme>
      {THEME_LABEL[theme]}
    </button>
  );
}
