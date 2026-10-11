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
        <Link href={blog ? `/@${blog.slug}` : "/"} className="flex min-h-11 items-center text-xl font-extrabold text-accent">
          Blogville
        </Link>
        {blog && (
          <nav className="flex items-center gap-1" aria-label="회원 메뉴">
            <Link href={`/@${blog.slug}`} className="btn btn-ghost">
              내 블로그
            </Link>
            <Link href="/write" className="btn btn-primary">
              ✏️ 글쓰기
            </Link>
            <SignOutButton />
          </nav>
        )}
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
