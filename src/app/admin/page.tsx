import Link from "next/link";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";
import { ResetPasswordButton } from "@/components/admin/ResetPasswordButton";
import { formatDateTime } from "@/lib/comment-rules";
import { normalizeName } from "@/lib/names";
import { findMemberByUsername, getAdminStats, listRecentMembers, listRecentPosts, RECENT_MEMBERS, RECENT_POST_DAYS } from "@/server/admin";
import { requireAdmin } from "@/server/dal";
import { countNewFeedback } from "@/server/feedback";
import { DailyBarChart } from "@/components/admin/DailyBarChart";
import { parseStatRange, STAT_RANGES } from "@/lib/admin-rules";
import { getDailyStats, getModerationCounts, getTopBlogs } from "@/server/admin-tools";
import { countOpenReports } from "@/server/reports";
import { countRecentErrors } from "@/server/error-log";

export const metadata = { title: "관리자 | Blogville" };

const PROVIDERS: Record<string, string> = { credential: "아이디", kakao: "카카오", naver: "네이버", google: "Google" };

// 관리자 대시보드 (AUTH-08, ADM-03). 관리자가 아니면 404.
export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  // 회원 찾기 (비밀번호 초기화): 아이디가 정확히 같은 1명. 64자를 넘거나 문자열이 아니면 찾지 않는다
  const params = await searchParams;
  const raw = params.member;
  const range = parseStatRange(params.range);
  const query = typeof raw === "string" ? normalizeName(raw) : "";
  const searched = query.length > 0 && query.length <= 64;
  const [stats, members, recent, found, newFeedback, daily, topBlogs, moderation, openReports, recentErrors] = await Promise.all([
    getAdminStats(),
    listRecentMembers(),
    listRecentPosts(),
    searched ? findMemberByUsername(query) : null,
    countNewFeedback(),
    getDailyStats(range),
    getTopBlogs(),
    getModerationCounts(),
    countOpenReports(),
    countRecentErrors(),
  ]);
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

      {/* 활동 통계 (ADM-03): 최근 7·30일 날마다 가입자·글·댓글·방문 */}
      <section aria-labelledby="admin-activity" className="space-y-3 rounded-2xl border border-line bg-surface p-4" data-activity-range={range}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="admin-activity" className="font-bold">
            📈 최근 {range}일 활동
          </h2>
          <nav aria-label="기간" className="flex gap-1">
            {STAT_RANGES.map((r) => (
              <Link key={r} href={r === 7 ? "/admin" : `/admin?range=${r}`} aria-current={r === range ? "page" : undefined} className={`btn ${r === range ? "btn-current" : ""}`}>
                {r}일
              </Link>
            ))}
          </nav>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <DailyBarChart stats={daily} metric="signups" label="가입자" unit="명" />
          <DailyBarChart stats={daily} metric="posts" label="글" unit="개" />
          <DailyBarChart stats={daily} metric="comments" label="댓글·답글" unit="개" />
          <DailyBarChart stats={daily} metric="visits" label="블로그 방문" unit="회" />
        </div>
        <p className="text-sm text-ink-soft">
          지금 정지된 회원 <Link href="/admin/members?filter=suspended" className="underline">{moderation.suspended.toLocaleString("ko-KR")}명</Link> · 블라인드 글{" "}
          {moderation.blinded.toLocaleString("ko-KR")}개
        </p>
      </section>

      <section aria-labelledby="top-blogs" className="rounded-2xl border border-line bg-surface p-4">
        <h2 id="top-blogs" className="mb-3 font-bold">
          🏆 최근 30일 방문 많은 블로그
        </h2>
        {topBlogs.length === 0 ? (
          <p className="text-ink-soft">방문 기록이 없어요</p>
        ) : (
          <ol className="list-decimal space-y-1 pl-6 text-sm">
            {topBlogs.map((b) => (
              <li key={b.blogId} data-top-blog={b.slug}>
                <Link href={`/@${b.slug}`} className="font-semibold underline">
                  {b.title}
                </Link>{" "}
                <span className="text-ink-soft">
                  {b.nickname} · 방문 {b.visits.toLocaleString("ko-KR")}회
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 🚨 신고 (specs/059-report-bookmarks): 처리하지 않은 신고 수 */}
      <section aria-labelledby="admin-reports" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface p-4">
        <h2 id="admin-reports" className="font-bold">
          🚨 신고{" "}
          <span className={openReports.reports > 0 ? "text-danger" : "text-ink-soft"} data-reports-open={openReports.reports}>
            처리 대기 {openReports.reports.toLocaleString("ko-KR")}건
          </span>
          {openReports.reports > 0 && <span className="text-sm font-normal text-ink-soft"> (대상 {openReports.targets.toLocaleString("ko-KR")}개)</span>}
        </h2>
        <Link href="/admin/reports" className="btn">
          신고 보기
        </Link>
      </section>

      {/* 버그·문의 (SUP-03): 새로 들어온(접수) 문의 수 */}
      <section aria-labelledby="admin-feedback" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface p-4">
        <h2 id="admin-feedback" className="font-bold">
          🐞 버그·문의{" "}
          <span className={newFeedback > 0 ? "text-danger" : "text-ink-soft"} data-feedback-new={newFeedback}>
            새 문의 {newFeedback.toLocaleString("ko-KR")}건
          </span>
        </h2>
        <Link href={newFeedback > 0 ? "/admin/feedback?status=new" : "/admin/feedback"} className="btn">
          문의 보기
        </Link>
      </section>

      {/* 서버 오류 기록: 최근 24시간에 난 처리 못 한 서버 오류 횟수 */}
      <section aria-labelledby="admin-errors" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface p-4">
        <h2 id="admin-errors" className="font-bold">
          <span className={recentErrors.total > 0 ? "text-danger" : "text-ink-soft"} data-errors-recent={recentErrors.total}>
            ⚠️ 최근 24시간 오류 {recentErrors.total.toLocaleString("ko-KR")}건
          </span>
        </h2>
        <Link href="/admin/errors" className="btn">
          오류 보기
        </Link>
      </section>

      <section aria-labelledby="find-member" className="rounded-2xl border border-line bg-surface p-4">
        <h2 id="find-member" className="mb-3 font-bold">
          회원 찾기
        </h2>
        <form method="get" action="/admin" className="flex flex-wrap items-center gap-2">
          <label htmlFor="member-search" className="sr-only">
            찾을 아이디
          </label>
          <input
            id="member-search"
            name="member"
            defaultValue={typeof raw === "string" ? raw : ""}
            placeholder="아이디"
            maxLength={64}
            autoComplete="off"
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-line px-3"
          />
          <button type="submit" className="btn">
            찾기
          </button>
        </form>
        {searched && !found && <p className="mt-3 text-ink-soft">그 아이디의 회원이 없어요</p>}
        {found && (
          <div className="mt-3 space-y-2 text-sm" data-found-member={found.username}>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold">{found.username}</span>
              <span>{found.nickname}</span>
              {found.slug && (
                <Link href={`/@${found.slug}`} className="flex min-h-11 items-center text-accent underline">
                  /@{found.slug}
                </Link>
              )}
              <span>{found.role === "admin" ? "👑 관리자" : "회원"}</span>
              <span className="text-ink-soft">가입 {formatDateTime(found.createdAt)}</span>
            </p>
            {found.role === "admin" ? (
              <p className="text-ink-soft">관리자의 비밀번호는 여기서 초기화할 수 없어요.</p>
            ) : (
              <ResetPasswordButton key={found.userId} userId={found.userId} username={found.username ?? ""} />
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="recent-members" className="rounded-2xl border border-line bg-surface p-4">
        <h2 id="recent-members" className="mb-3 font-bold">
          최근 가입 ({RECENT_MEMBERS}명)
        </h2>
        <Link href="/admin/members" className="mb-2 flex min-h-11 w-fit items-center text-sm text-accent underline">
          회원 관리에서 찾기·정지·권한 바꾸기
        </Link>
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
