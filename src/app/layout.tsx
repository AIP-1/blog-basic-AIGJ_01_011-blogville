import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { getMyBlog, getSession } from "@/server/dal";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blogville",
  description: "글을 쓸수록 내 마을이 자라는 블로그",
};

async function Header() {
  const member = await getSession();
  const blog = member ? await getMyBlog(member.userId) : null;
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2">
        <Link href={blog ? `/@${blog.slug}` : "/"} className="flex min-h-11 shrink-0 items-center whitespace-nowrap text-xl font-extrabold text-accent">
          Blogville
        </Link>
        <nav className="flex items-center gap-1" aria-label="메뉴">
          {/* 마을(광장)이 아직 없어 마을 소식은 헤더에서 들어간다 (SOC-05, 요구사항 1.34 메모) */}
          <Link href="/feed" className="btn btn-ghost px-2" aria-label="마을 소식">
            📋<span className="hidden sm:inline">마을 소식</span>
          </Link>
          {member && blog && (
            <>
              <Link href={`/@${blog.slug}`} className="btn btn-ghost header-my-blog">
                내 블로그
              </Link>
              <Link href="/write" className="btn btn-primary">
                ✏️ 글쓰기
              </Link>
              <SignOutButton userId={member.userId} />
            </>
          )}
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
