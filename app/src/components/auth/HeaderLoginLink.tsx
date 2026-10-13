"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { loginHref } from "@/lib/safe-next";

/** 방문자 헤더의 [로그인]. 로그인하면 지금 보던 화면으로 돌아온다 (레이아웃은 주소를 모르므로 클라이언트에서 읽는다). */
export function HeaderLoginLink() {
  const pathname = usePathname();
  return (
    <Link href={loginHref(pathname)} className="btn btn-ghost">
      로그인
    </Link>
  );
}
