// 받침에 따라 조사를 고른다 (GAME-06 `Lv.3이`, `Lv.4가`). 숫자는 한국어로 읽은 소리로 본다.

type JosaPair = "이/가" | "을/를" | "은/는" | "과/와";

// 일 이 삼 사 오 육 칠 팔 구 → 받침 있음: 1·3·6·7·8. 0(영)도 받침이 있다.
const DIGIT_HAS_FINAL = [true, true, false, true, false, false, true, true, true, false];

/** 끝 글자에 받침이 있는지. 한글·숫자가 아니면 null */
export function hasFinalConsonant(word: string): boolean | null {
  const last = word.trim().at(-1);
  if (!last) return null;
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/\d/.test(last)) {
    const digits = word.trim().match(/\d+$/)![0].replace(/^0+(?=\d)/, "");
    if (digits === "0") return true;
    // 끝이 0이면 십·백·천(받침 있음)·만(받침 있음)으로 끝난다
    if (digits.endsWith("0")) return true;
    return DIGIT_HAS_FINAL[Number(last)];
  }
  return null;
}

/** `withJosa("Lv.3", "이/가")` → `Lv.3이`. 알 수 없으면 앞의 것(이/을/은/과) */
export function withJosa(word: string, pair: JosaPair): string {
  const [withFinal, withoutFinal] = pair.split("/");
  return word + (hasFinalConsonant(word) === false ? withoutFinal : withFinal);
}
