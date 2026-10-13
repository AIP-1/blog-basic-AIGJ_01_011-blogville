import Link from "next/link";
import { CategoryManager } from "@/components/settings/CategoryManager";
import { VisitChart } from "@/components/settings/VisitChart";
import { BlogInfoForm, SlugForm } from "@/components/settings/SettingsForms";
import { getCategoryTree } from "@/server/category";
import { getMyBlog, requireMember } from "@/server/dal";
import { getBlogVisitDays, getBlogVisitStats, getPopularPosts, getReferrerStats } from "@/server/stats";
import { PopularPosts, ReferrerList } from "@/components/settings/BlogInsights";
import { EXPORT_MESSAGES } from "@/lib/export";

export const metadata = { title: "블로그 관리 | Blogville" };

function Card({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-2xl border border-line bg-surface p-5">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default async function BlogSettingsPage({ searchParams }: PageProps<"/settings/blog">) {
  const member = await requireMember();
  const query = await searchParams;
  // 내보내기를 10분 안에 다시 누르면 라우트 핸들러가 ?export=wait&min=N으로 돌려보낸다
  const waitMin = query.export === "wait" ? Math.min(10, Math.max(1, Number(query.min) || 10)) : null;
  const blog = await getMyBlog(member.userId);
  const [tree, stats, days, referrers, popular] = await Promise.all([
    getCategoryTree(blog.id, true),
    getBlogVisitStats(blog.id),
    getBlogVisitDays(blog.id),
    getReferrerStats(blog.id),
    getPopularPosts(blog.id),
  ]);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">블로그 관리</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/settings/posts" className="btn">
            📝 글 관리
          </Link>
          <Link href="/settings/comments" className="btn">
            💬 댓글 관리
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
      <Card id="referrers" title="🧭 어디서 왔나요 (최근 30일)">
        <ReferrerList stats={referrers} />
      </Card>
      <Card id="popular" title="🏆 인기 글">
        <PopularPosts slug={blog.slug} posts={popular} />
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
      <Card id="export" title="📦 내보내기">
        <p className="mb-3 text-sm text-ink-soft">
          글(비공개·예약 글 포함)·사진과 파일·카테고리·댓글·방명록을 .zip 파일 하나로 내려받아요. 압축을 풀면 브라우저로 글을 읽을 수 있고, Markdown 파일로 다른 곳에 옮길 수도 있어요.
        </p>
        {waitMin !== null && (
          <p role="alert" className="form-error mb-3">
            {EXPORT_MESSAGES.wait(waitMin)}
          </p>
        )}
        {/* 파일을 내려받는 주소라 Link(미리 불러오기) 대신 a */}
        <a href={`/settings/export?blog=${blog.slug}`} className="btn">
          내 블로그 내려받기 (.zip)
        </a>
        <p className="mt-2 text-xs text-ink-soft">10분에 한 번 내려받을 수 있어요. 글과 첨부가 많으면 시간이 조금 걸려요.</p>
      </Card>
    </div>
  );
}
