import type { CSSProperties } from "react";
import Link from "next/link";
import { sheetChars } from "@/lib/sheet";

/**
 * 원고지 제목 (블로그 꾸미기): 블로그 이름을 원고지 칸에 한 글자씩 적는다. 칸 선은 블로그 강조색.
 * 빈칸(띄어쓰기)도 한 칸을 차지한다. 칸 크기는 한 줄에 다 들어가게 정하고(--count), 너무 작아지면 줄을 바꾼다.
 * 칸이 작아도 누르는 곳은 44px 이상 (NF-06): 링크가 칸 줄을 감싸고 높이를 지킨다.
 */
export function SheetTitle({ text, href, className = "" }: { text: string; href: string; className?: string }) {
  return (
    // 칸마다 상자라 브라우저가 글자 사이를 띄워 읽는다. 읽는 이름은 제목 그대로 준다
    <Link href={href} aria-label={text} className={`sheet-wrap sheet-link flex min-h-11 w-full items-center ${className}`}>
      <SheetLine text={text} size="lg" />
    </Link>
  );
}

/** 원고지 줄. 감싼 칸에 `sheet-wrap`(너비 기준)이 있어야 하고, 링크라면 링크에 aria-label로 이름을 준다 */
export function SheetLine({ text, size = "sm" }: { text: string; size?: SheetSize }) {
  const chars = sheetChars(text);
  return (
    <span className="sheet" data-sheet-size={size} style={countStyle(chars)}>
      <SheetCells chars={chars} />
    </span>
  );
}

type SheetSize = "lg" | "sm";

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
