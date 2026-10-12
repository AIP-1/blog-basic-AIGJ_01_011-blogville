"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PHONE_MEDIA } from "./TownGame";

/**
 * 휴대폰에는 마을이 없다 (TOWN-01): 회원은 내 블로그(친구 마을 구경이면 그 회원의 블로그, TOWN-15)로 옮기고, 방문자는 간단 메뉴를 본다.
 * PC 화면에서는 CSS가 숨긴다.
 */
export function PhoneTown({ mySlug, host = null }: { mySlug: string | null; host?: { nickname: string; slug: string } | null }) {
  const router = useRouter();
  // 친구 마을 구경(TOWN-15)은 그 회원의 블로그로
  const target = host?.slug ?? mySlug;
  useEffect(() => {
    if (target && window.matchMedia(PHONE_MEDIA).matches) router.replace(`/@${target}`);
  }, [target, router]);
  if (host) return <p className="p-6 text-center text-ink-soft">{host.nickname}님의 블로그로 가는 중…</p>;
  if (mySlug) return <p className="p-6 text-center text-ink-soft">내 블로그로 가는 중…</p>;
  return (
    <div className="mx-auto max-w-sm space-y-4 p-6 text-center" data-phone-town>
      <h2 className="text-xl font-bold">🏘 Blogville 마을 구경</h2>
      <p className="text-ink-soft">로그인하면 내 블로그 집이 생겨요.</p>
      <div className="flex justify-center gap-2">
        <Link href="/feed" className="btn">
          📋 마을 소식
        </Link>
        <Link href="/" className="btn btn-primary">
          🔑 시작하기
        </Link>
      </div>
    </div>
  );
}
