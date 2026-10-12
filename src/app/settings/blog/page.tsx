import Link from "next/link";
import { CategoryManager } from "@/components/settings/CategoryManager";
import { VisitChart } from "@/components/settings/VisitChart";
import { BlogInfoForm, SlugForm } from "@/components/settings/SettingsForms";
import { getCategoryTree } from "@/server/category";
import { getMyBlog, requireMember } from "@/server/dal";
import { getBlogVisitDays, getBlogVisitStats } from "@/server/stats";

export const metadata = { title: "블로그 관리 | Blogville" };

function Card({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-2xl border border-line bg-surface p-5">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default async function BlogSettingsPage() {
  const member = await requireMember();
  const blog = await getMyBlog(member.userId);
  const [tree, stats, days] = await Promise.all([getCategoryTree(blog.id, true), getBlogVisitStats(blog.id), getBlogVisitDays(blog.id)]);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">블로그 관리</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/settings/posts" className="btn">
            📝 글 관리
          </Link>
          <Link href="/settings/account" className="btn">
            👤 내 정보
          </Link>
          <Link href={`/@${blog.slug}`} className="btn">
            내 블로그로 →
          </Link>
        </div>
      </div>
      <Card id="visits" title="👣 방문자">
        <VisitChart stats={stats} days={days} />
      </Card>
      <Card title="블로그 정보">
        <BlogInfoForm title={blog.title} intro={blog.intro} />
      </Card>
      <Card title="블로그 주소">
        <SlugForm slug={blog.slug} />
      </Card>
      <Card id="categories" title="카테고리">
        <CategoryManager tree={tree} />
      </Card>
    </div>
  );
}
