import type { CSSProperties } from "react";
import Link from "next/link";
import { sheetChars } from "@/lib/sheet";


/**
 * 원고지 제목 (블로그 꾸미기): 블로그 이름을 원고지 칸에 한 글자씩 적는다. 칸 선은 블로그 강조색.
 * 빈칸(띄어쓰기)도 한 칸을 차지한다. 글자는 그대로 링크 글자라 읽는 이름은 블로그 이름과 같다.
 * 칸 크기는 한 줄에 다 들어가게 정하고(--count), 너무 작아지면 줄을 바꾼다. 감싼 칸에 `sheet-wrap`이 있어야 한다.
 */
export function SheetTitle({ text, href, size, className = "" }: { text: string; href: string; size?: SheetSize; className?: string }) {
  const chars = sheetChars(text);
  return (
    <Link href={href} className={`sheet ${className}`} data-sheet-size={size} style={countStyle(chars)}>
      <SheetCells chars={chars} />
    </Link>
  );
}

/** 링크 안에 넣는 원고지 줄 (글 화면 위의 블로그 이름) */
export function SheetLine({ text, size = "sm" }: { text: string; size?: SheetSize }) {
  const chars = sheetChars(text);
  return (
    <span className="sheet" data-sheet-size={size} style={countStyle(chars)}>
      <SheetCells chars={chars} />
    </span>
  );
}

type SheetSize = "sm";

function countStyle(chars: string[]): CSSProperties {
  return { "--count": Math.max(chars.length, 1) } as CSSProperties;
}

function SheetCells({ chars }: { chars: string[] }) {
  return chars.map((c, i) => (
    <span key={i} className="sheet-cell">
      {c}
    </span>
  ));
}
