import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { getMyBlog, getSession } from "@/server/dal";

export default async function Home() {
  const member = await getSession();
  if (member) redirect(`/@${(await getMyBlog(member.userId)).slug}`);

  return (
    <div className="grid items-center gap-8 py-6 md:grid-cols-[1fr_380px] md:py-12">
      <section>
        <h1 className="text-4xl font-extrabold tracking-tight text-accent md:text-5xl">Blogville</h1>
        <p className="mt-3 text-lg font-semibold">글을 쓸수록 내 마을이 자라요</p>
        <p className="mt-4 max-w-prose text-ink-soft">
          아이디 하나로 가입하면 내 블로그가 바로 생겨요. 글을 쓰고, 공개할지 정하고, 카테고리로 차곡차곡 정리해 보세요.
        </p>
      </section>
      <AuthPanel />
    </div>
  );
}
