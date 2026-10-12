import type { Metadata } from "next";
import Link from "next/link";
import { HeaderLoginLink } from "@/components/auth/HeaderLoginLink";
import { SessionKeeper } from "@/components/auth/SessionKeeper";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { PixelCharacter } from "@/components/game/PixelCharacter";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { getMyBlog, getSession } from "@/server/dal";
import { formatNumber } from "@/lib/game";
import { countUnreadNotifications } from "@/server/notifications";
import { getCharacter } from "@/server/items";
import { getWallet } from "@/server/points";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blogville",
  description: "글을 쓸수록 내 마을이 자라는 블로그",
};

async function Header() {
  const member = await getSession();
  const [blog, unread, wallet, character] = member
    ? await Promise.all([getMyBlog(member.userId), countUnreadNotifications(member.userId), getWallet(member.userId), getCharacter(member.userId)])
    : [null, 0, null, null];
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-2 px-4 py-2">
        <Link href={blog ? `/@${blog.slug}` : "/"} className="flex min-h-11 shrink-0 items-center whitespace-nowrap text-xl font-extrabold text-accent">
          Blogville
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-1" aria-label="메뉴">
          {/* 마을(광장)이 아직 없어 마을 소식은 헤더에서 들어간다 (SOC-05, 요구사항 1.34 메모) */}
          <Link href="/feed" className="btn btn-ghost px-2" aria-label="마을 소식">
            📋<span className="hidden sm:inline">마을 소식</span>
          </Link>
          {member && blog && (
            <>
              {member.role === "admin" && (
                <Link href="/admin" className="btn btn-ghost px-2" aria-label="관리자">
                  👑<span className="hidden sm:inline">관리자</span>
                </Link>
              )}
              {wallet && (
                // 레벨·코인 (GAME-02·03), 누르면 내역 (GAME-07)
                <Link
                  href="/wallet"
                  className="btn btn-ghost gap-1 px-2 text-sm"
                  aria-label={`Lv.${wallet.progress.level}, 코인 ${formatNumber(wallet.coin)}: 경험치·코인 내역`}
                  data-wallet
                >
                  {/* 내 캐릭터 (GAME-01) */}
                  <PixelCharacter art={character?.art} size={28} />
                  <span className="rounded-full bg-accent/10 px-1.5 font-bold text-accent">Lv.{wallet.progress.level}</span>
                  <span className="whitespace-nowrap">🪙 {formatNumber(wallet.coin)}</span>
                </Link>
              )}
              <NotificationBell unread={{ count: unread }} />
              <Link href="/settings/account" className="btn btn-ghost px-2" aria-label="내 정보">
                👤<span className="hidden sm:inline">내 정보</span>
              </Link>
              <Link href={`/@${blog.slug}`} className="btn btn-ghost header-my-blog">
                내 블로그
              </Link>
              <Link href="/write" className="btn btn-primary">
                ✏️ 글쓰기
              </Link>
              <SignOutButton userId={member.userId} />
              {member.rememberMe && <SessionKeeper />}
            </>
          )}
          {!member && <HeaderLoginLink />}
        </nav>
      </div>
    </header>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body className="flex min-h-dvh flex-col">
        <Header />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
