// 원고지 제목 (components/blog/SheetTitle.tsx): 한 칸에 들어갈 글자 단위

/** 글자 하나하나로 나눈다. 이모지·조합 글자(👩‍💻, é)도 한 칸, 띄어쓰기도 한 칸 */
export function sheetChars(text: string): string[] {
  return Array.from(new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(text), (s) => s.segment);
}
