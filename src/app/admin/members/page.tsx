import type { Metadata } from "next";
import Link from "next/link";
import { adminSetRole, adminSuspend, adminUnsuspend } from "@/app/admin/tools-actions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { ResetPasswordButton } from "@/components/admin/ResetPasswordButton";
import { Pagination } from "@/components/blog/Pagination";
import { ADMIN_PAGE_SIZE, isSuspended, parseQuery, REASON_MAX, SUSPEND_DAYS, suspendLabel, suspendedMessage } from "@/lib/admin-rules";
import { formatDateTime } from "@/lib/comment-rules";
import { parsePage } from "@/lib/ids";
import { listMembers, type MemberFilter } from "@/server/admin-tools";
import { requireAdmin } from "@/server/dal";

export const metadata: Metadata = { title: "회원 | 관리자 | Blogville" };

const FILTERS: { value: MemberFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "suspended", label: "정지된 회원" },
  { value: "admin", label: "관리자" },
];

// 관리자 회원 관리: 찾기, 정지·정지 풀기, 관리자 권한 주기·빼기, 비밀번호 초기화
export default async function AdminMembersPage({ searchParams }: PageProps<"/admin/members">) {
  const me = await requireAdmin();
  const params = await searchParams;
  const query = parseQuery(params.q);
  const filter = FILTERS.find((f) => f.value === params.filter)?.value ?? "all";
  const page = parsePage(params.page);
  const { items, total } = await listMembers({ query, filter, page });
  const keep = { ...(query && { q: query }), ...(filter !== "all" && { filter }) };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">👥 회원 관리</h1>
      <form method="get" action="/admin/members" className="flex flex-wrap items-center gap-2" role="search">
        <label htmlFor="member-q" className="sr-only">
          아이디나 닉네임
        </label>
        <input id="member-q" name="q" defaultValue={query} placeholder="아이디나 닉네임" maxLength={50} className="field min-w-0 flex-1" />
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        <button type="submit" className="btn">
          찾기
        </button>
      </form>
      <nav aria-label="회원 거르기" className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/members?${new URLSearchParams({ ...(query && { q: query }), ...(f.value !== "all" && { filter: f.value }) })}`}
            aria-current={f.value === filter ? "page" : undefined}
            className={`btn ${f.value === filter ? "btn-current" : ""}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      <p className="text-sm text-ink-soft">{total.toLocaleString("ko-KR")}명</p>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-5 text-ink-soft">찾는 회원이 없어요</p>
      ) : (
        <ul className="space-y-3">
          {items.map((m) => {
            const suspended = isSuspended(m.suspendedUntil);
            const isMe = m.userId === me.userId;
            return (
              <li key={m.userId} className="space-y-2 rounded-2xl border border-line bg-surface p-4 text-sm" data-admin-member={m.username}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-base font-bold">{m.username}</span>
                  <span>{m.nickname}</span>
                  {m.slug && (
                    <Link href={`/@${m.slug}`} className="flex min-h-11 items-center text-accent underline">
                      /@{m.slug}
                    </Link>
                  )}
                  {m.role === "admin" && <span className="rounded-full bg-accent/10 px-2 py-0.5 font-bold text-accent">👑 관리자</span>}
                  {suspended && (
                    <span className="rounded-full bg-danger/10 px-2 py-0.5 font-bold text-danger" data-suspended>
                      🚫 정지
                    </span>
                  )}
                </div>
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-ink-soft">
                  <span>글 {m.postCount.toLocaleString("ko-KR")}개</span>
                  <span>가입 {formatDateTime(m.createdAt)}</span>
                  <span>마지막 접속 {m.lastSeen ? formatDateTime(m.lastSeen) : "-"}</span>
                </p>
                {suspended && m.suspendedUntil && <p className="text-danger">{suspendedMessage(m.suspendedUntil, m.suspendReason)}</p>}

                {!isMe && (
                  <details className="rounded-xl bg-bg p-3">
                    <summary className="flex min-h-11 cursor-pointer items-center font-semibold">관리</summary>
                    <div className="mt-2 space-y-3">
                      {m.role !== "admin" &&
                        (suspended ? (
                          <AdminActionForm action={adminUnsuspend} label="정지 풀기" confirm={`${m.username} 님의 정지를 풀까요?`} className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="userId" value={m.userId} />
                            <button type="submit" className="btn">
                              정지 풀기
                            </button>
                          </AdminActionForm>
                        ) : (
                          <AdminActionForm
                            action={adminSuspend}
                            label="회원 정지"
                            confirm={`${m.username} 님을 정지할까요? 바로 로그아웃되고 기간 동안 로그인할 수 없어요.`}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <input type="hidden" name="userId" value={m.userId} />
                            <label className="sr-only" htmlFor={`days-${m.userId}`}>
                              정지 기간
                            </label>
                            <select id={`days-${m.userId}`} name="days" defaultValue="7" className="field field-auto">
                              {SUSPEND_DAYS.map((d) => (
                                <option key={d} value={d}>
                                  {suspendLabel(d)}
                                </option>
                              ))}
                            </select>
                            <label className="sr-only" htmlFor={`reason-${m.userId}`}>
                              정지 사유
                            </label>
                            <input id={`reason-${m.userId}`} name="reason" required maxLength={REASON_MAX} placeholder="사유 (회원에게 보여요)" className="field min-w-0 flex-1" />
                            <button type="submit" className="btn btn-danger">
                              정지
                            </button>
                          </AdminActionForm>
                        ))}
                      <AdminActionForm
                        action={adminSetRole}
                        label="관리자 권한"
                        confirm={m.role === "admin" ? `${m.username} 님의 관리자 권한을 뺄까요?` : `${m.username} 님을 관리자로 만들까요? 모든 관리자 기능을 쓸 수 있게 돼요.`}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="userId" value={m.userId} />
                        <input type="hidden" name="role" value={m.role === "admin" ? "user" : "admin"} />
                        <button type="submit" className="btn">
                          {m.role === "admin" ? "관리자 권한 빼기" : "👑 관리자로 만들기"}
                        </button>
                      </AdminActionForm>
                      {m.role !== "admin" && <ResetPasswordButton key={m.userId} userId={m.userId} username={m.username} />}
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Pagination basePath="/admin/members" query={keep} page={page} totalPages={Math.ceil(total / ADMIN_PAGE_SIZE)} />
    </div>
  );
}
