"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { supportHref } from "@/lib/support-rules";

/** 아래 막대의 [🐞 버그·문의하기] (SUP-01): 지금 보는 주소를 `?from=`으로 넘겨 문의에 남긴다 */
export function SupportLink({ className }: { className: string }) {
  const pathname = usePathname();
  return (
    <Link href={supportHref(pathname)} className={className} data-support-link>
      🐞 버그·문의하기
    </Link>
  );
}
