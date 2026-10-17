import { NextResponse, type NextRequest } from "next/server";

// /@주소(블로그 홈·글·방명록·RSS)를 /blog/주소로 잇는다 (BLOG-02). `@`로 시작하는 폴더는 parallel route라 주소로 못 쓴다.
// next.config의 rewrites로 하면 Next 16.4가 브라우저에 "바뀐 검색 조건 없음"(x-nextjs-rewritten-query 빈 값)을 알려 줘서,
// 미리 받아 둔 /@주소?category=… 를 누르면 주소만 바뀌고 글 목록은 그대로였다. 여기서는 ?뒤를 그대로 넘겨 그 머리말이 붙지 않는다.
export function proxy(request: NextRequest) {
  const match = /^\/@([^/]+)(\/[^/]+)?\/?$/.exec(request.nextUrl.pathname);
  if (!match) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/blog/${match[1]}${match[2] ?? ""}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/@:slug", "/@:slug/:rest"],
};
