"use client";

import dynamic from "next/dynamic";

// 한글 글꼴(약 150~340KB)은 첫 화면을 그린 뒤 받는다. 그전에는 기기 글꼴(Apple SD Gothic Neo·Noto Sans KR)로 보이고,
// 받으면 Pretendard로 바뀐다(font-display: swap). 글꼴 파일은 /_next/static이라 다음부터는 캐시에서 바로 온다.
const PretendardFont = dynamic(() => import("./PretendardFont"), { ssr: false });
// 블로그 제목·글 제목의 명조(고운바탕)도 같은 방법으로. 제목에 쓰인 글자 범위 파일만 받는다
const SerifFont = dynamic(() => import("./SerifFont"), { ssr: false });

export function LateFonts() {
  return (
    <>
      <PretendardFont />
      <SerifFont />
    </>
  );
}
