"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUnreadCount } from "@/components/notifications/NotificationBell";
import { unreadBadge } from "@/lib/notifications";

/**
 * 휴대폰 회원의 아래 탭 (TOWN-11·12, NF-06, specs/040-phone-tabs): 휴대폰에는 마을이 없어
 * 🏠 내 블로그 · 📋 마을 소식 · 🏪 상점 · 🔔 알림 · ☰ 메뉴(`/town?menu=1`)로 다닌다. PC에서는 CSS가 숨긴다.
 */
export function PhoneTabs({ slug, unread }: { slug: string; unread: { count: number } }) {
  const pathname = decodeURIComponent(usePathname());
  const badge = unreadBadge(useUnreadCount(unread));
  const tabs = [
    { href: `/@${slug}`, icon: "🏠", label: "내 블로그", on: pathname === `/@${slug}` || pathname.startsWith(`/@${slug}/`) },
    { href: "/feed", icon: "📋", label: "마을 소식", on: pathname === "/feed" },
    { href: "/shop", icon: "🏪", label: "상점", on: pathname === "/shop" },
    { href: "/notifications", icon: "🔔", label: "알림", on: pathname === "/notifications" },
    { href: "/town?menu=1", icon: "☰", label: "메뉴", on: pathname === "/town" },
  ];
  return (
    <nav
      aria-label="아래 탭"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
      data-phone-tabs
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {tabs.map((t) => (
          <li key={t.label}>
            <Link
              href={t.href}
              aria-current={t.on ? "page" : undefined}
              aria-label={t.label === "알림" && badge ? `알림, 안 읽은 알림 ${badge}개` : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center text-xs ${t.on ? "font-bold text-accent" : "text-ink-soft"}`}
            >
              <span className="text-lg leading-6" aria-hidden="true">
                {t.icon}
              </span>
              {t.label}
              {t.label === "알림" && badge && (
                <span
                  className="absolute left-1/2 top-1 ml-1.5 min-w-5 rounded-full bg-danger px-1 text-center text-xs leading-5 font-bold text-white"
                  aria-hidden="true"
                  data-unread
                >
                  {badge}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
