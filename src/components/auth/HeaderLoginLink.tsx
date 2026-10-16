"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { loginHref } from "@/lib/safe-next";

/** 방문자 헤더의 [로그인] (가입도 같은 첫 화면). 로그인하면 지금 보던 화면으로 돌아온다 (레이아웃은 주소를 모르므로 클라이언트에서 읽는다). */
export function HeaderLoginLink() {
  const pathname = usePathname();
  return (
    // 미리 받지 않는다: 주소마다 ?next=가 달라 첫 화면(/)을 화면마다 따로 두 번씩 미리 받고 있었다
    <Link href={loginHref(pathname)} prefetch={false} className="btn btn-primary rounded-full px-4">
      로그인
    </Link>
  );
}
