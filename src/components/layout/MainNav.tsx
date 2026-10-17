"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 헤더 왼쪽 큰 메뉴 (로고 옆): 지금 보는 곳은 굵게 + 밑줄. 휴대폰 회원은 아래 탭이 있어 숨긴다 */
export function MainNav({ member, food = false }: { member: boolean; food?: boolean }) {
  const pathname = usePathname();
  const items = [
    // 마을(TOWN-01)은 휴대폰에 없다
    { href: "/town", label: "마을", match: (p: string) => p.startsWith("/town"), desktopOnly: true },
    { href: "/feed", label: "마을 소식", match: (p: string) => p.startsWith("/feed"), desktopOnly: false },
    { href: "/popular", label: "인기 글", match: (p: string) => p.startsWith("/popular"), desktopOnly: false },
    // 🍽 맛집: 카카오·네이버 열쇠가 하나라도 있을 때만
    ...(food ? [{ href: "/food", label: "맛집", match: (p: string) => p.startsWith("/food"), desktopOnly: false }] : []),
  ];
  return (
    <ul className={`flex items-center gap-0.5 ${member ? "max-sm:hidden" : ""}`} data-main-nav>
      {items.map((it) => {
        const on = it.match(pathname);
        return (
          <li key={it.href} className={it.desktopOnly ? "max-sm:hidden" : ""}>
            <Link
              href={it.href}
              aria-current={on ? "page" : undefined}
              className={`relative flex min-h-11 items-center whitespace-nowrap rounded-lg px-2 text-[15px] sm:px-2.5 transition-colors hover:bg-bg ${
                on ? "font-bold text-ink after:absolute after:inset-x-2 after:bottom-1 sm:after:inset-x-2.5 after:h-0.5 after:rounded-full after:bg-accent" : "font-medium text-ink-soft hover:text-ink"
              }`}
            >
              {it.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
