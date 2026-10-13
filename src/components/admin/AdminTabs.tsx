"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "📊 대시보드" },
  { href: "/admin/members", label: "👥 회원" },
  { href: "/admin/content", label: "📝 콘텐츠" },
  { href: "/admin/reports", label: "🚨 신고" },
  { href: "/admin/feedback", label: "🐞 버그·문의" },
  { href: "/admin/settings", label: "⚙️ 사이트 설정" },
  { href: "/admin/audit", label: "📜 관리 기록" },
  { href: "/admin/errors", label: "⚠️ 오류" },
] as const;

/** 관리자 화면 위 탭 (ADM-07). 지금 화면을 강조한다. 좁은 화면에서는 탭 줄만 옆으로 밀린다 */
export function AdminTabs() {
  const path = usePathname();
  return (
    <nav aria-label="관리자 메뉴" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" data-admin-tabs>
      {TABS.map((t) => {
        const current = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={current ? "page" : undefined} className={`btn shrink-0 whitespace-nowrap ${current ? "btn-current" : ""}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
