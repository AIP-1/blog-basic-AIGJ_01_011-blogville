// 화면 밝기 (개선 8): 기기 설정을 따르거나, 직접 어둡게·밝게 고른다. 고른 값은 이 브라우저에만 남긴다.

export type Theme = "system" | "dark" | "light";

export const THEME_KEY = "bv-theme";

export function parseTheme(value: string | null | undefined): Theme {
  return value === "dark" || value === "light" ? value : "system";
}

/** 버튼을 누르면: 기기 설정 → 어둡게 → 밝게 → 기기 설정 … */
export function nextTheme(current: Theme): Theme {
  return current === "system" ? "dark" : current === "dark" ? "light" : "system";
}

export const THEME_LABEL: Record<Theme, string> = {
  system: "🖥️ 기기 설정",
  dark: "🌙 어둡게",
  light: "☀️ 밝게",
};

/** 화면이 그려지기 전에 고른 밝기를 붙이는 짧은 스크립트 (깜빡임 막기). 저장소를 못 쓰면 기기 설정을 따른다 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;
