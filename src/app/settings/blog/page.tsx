import { CategoryManager } from "@/components/settings/CategoryManager";
import { BlogInfoForm, SlugForm } from "@/components/settings/SettingsForms";
import { getCategoryTree } from "@/server/category";
import { getMyBlog, requireMember } from "@/server/dal";

export const metadata = { title: "블로그 관리 | Blogville" };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default async function BlogSettingsPage() {
  const member = await requireMember();
  const blog = await getMyBlog(member.userId);
  const tree = await getCategoryTree(blog.id, true);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-extrabold">블로그 관리</h1>
      <Card title="블로그 정보">
        <BlogInfoForm title={blog.title} intro={blog.intro} />
      </Card>
      <Card title="블로그 주소">
        <SlugForm slug={blog.slug} />
      </Card>
      <Card title="카테고리">
        <CategoryManager tree={tree} />
      </Card>
    </div>
  );
}
