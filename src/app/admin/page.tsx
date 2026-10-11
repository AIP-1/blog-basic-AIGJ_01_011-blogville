import Link from "next/link";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";
import { formatDateTime } from "@/lib/comment-rules";
import { getAdminStats, listRecentMembers, listRecentPosts, RECENT_MEMBERS, RECENT_POST_DAYS } from "@/server/admin";
import { requireAdmin } from "@/server/dal";

export const metadata = { title: "관리자 | Blogville" };

const PROVIDERS: Record<string, string> = { credential: "아이디", kakao: "카카오", naver: "네이버", google: "Google" };

// 관리자 (AUTH-08). 관리자가 아니면 404.
export default async function AdminPage() {
  await requireAdmin();
  const [stats, members, recent] = await Promise.all([getAdminStats(), listRecentMembers(), listRecentPosts()]);
  const cards = [
    ["가입 계정", stats.members],
    ["전체 글", stats.posts],
    ["댓글", stats.comments],
    ["오늘 새 글", stats.todayPosts],
  ] as const;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">👑 관리자</h1>

      <section aria-label="통계" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-surface p-4 text-center">
            <p className="text-sm text-ink-soft">{label}</p>
            <p className="text-2xl font-extrabold" data-stat={label}>
              {value.toLocaleString("ko-KR")}
            </p>
          </div>
        ))}
      </section>

      <section aria-labelledby="recent-members" className="rounded-2xl border border-line bg-surface p-4">
        <h2 id="recent-members" className="mb-3 font-bold">
          최근 가입 ({RECENT_MEMBERS}명)
        </h2>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.username} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm" data-member={m.username}>
              <span className="font-semibold">
                {m.username} <span className="text-ink-soft">({PROVIDERS[m.provider ?? ""] ?? "아이디"})</span>
              </span>
              <span>{m.nickname}</span>
              {m.slug && (
                <Link href={`/@${m.slug}`} className="flex min-h-11 items-center text-accent underline">
                  /@{m.slug}
                </Link>
              )}
              <span>{m.role === "admin" ? "👑 관리자" : "회원"}</span>
              <span className="text-ink-soft">{formatDateTime(m.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="recent-posts" className="rounded-2xl border border-line bg-surface p-4">
        <h2 id="recent-posts" className="mb-3 font-bold">
          최근 {RECENT_POST_DAYS}일 글
        </h2>
        {recent.length === 0 ? (
          <p className="text-ink-soft">글이 없어요</p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1 text-sm" data-post={p.id}>
                {/* 비공개 글은 주인만 볼 수 있어 링크를 걸지 않는다 */}
                {p.isPublic ? (
                  <Link href={`/@${p.slug}/${p.id}`} className="flex min-h-11 min-w-0 flex-1 items-center font-semibold underline">
                    <span className="truncate">{p.title}</span>
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1 truncate font-semibold">{p.title}</span>
                )}
                <span>{p.nickname}</span>
                <span>{p.isPublic ? "공개" : "🔒"}</span>
                <span className="text-ink-soft">{formatDateTime(p.createdAt)}</span>
                <AdminDeleteButton postId={p.id} title={p.title} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
