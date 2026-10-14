import type { Metadata } from "next";
import Link from "next/link";
import { FeedbackAdminForm } from "@/components/admin/FeedbackAdminForm";
import { Pagination } from "@/components/blog/Pagination";
import { FeedbackStatusBadge } from "@/components/support/FeedbackStatusBadge";
import { formatDateTime } from "@/lib/time";
import { parsePage } from "@/lib/ids";
import { ADMIN_FEEDBACK_PAGE_SIZE, FEEDBACK_KIND_LABELS, FEEDBACK_STATUS_LABELS, FEEDBACK_STATUSES, isFeedbackStatus } from "@/lib/support-rules";
import { requireAdmin } from "@/server/dal";
import { listFeedbackForAdmin } from "@/server/feedback";

export const metadata: Metadata = { title: "버그·문의 | 관리자 | Blogville" };

const BY = { admin: "관리자", bot: "자동 처리" } as const;

// 관리자 버그·문의 (SUP-03, specs/057-support). 관리자가 아니면 404.
// 상태로 거르고(`?status=new`), 문의마다 쓴 사람·종류·내용·보던 주소·브라우저 정보를 보고 답변·상태를 바꾼다.
export default async function AdminFeedbackPage({ searchParams }: PageProps<"/admin/feedback">) {
  await requireAdmin();
  const params = await searchParams;
  const status = isFeedbackStatus(params.status) ? params.status : null;
  const page = parsePage(params.page);
  const { items, total } = await listFeedbackForAdmin(status, page);
  const filters = [{ value: null, label: "전체" }, ...FEEDBACK_STATUSES.map((s) => ({ value: s, label: FEEDBACK_STATUS_LABELS[s] }))];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">🐞 버그·문의</h1>

      <nav aria-label="상태로 거르기" className="flex flex-wrap gap-1">
        {filters.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/admin/feedback?status=${f.value}` : "/admin/feedback"}
            aria-current={f.value === status ? "page" : undefined}
            className={`btn ${f.value === status ? "btn-current" : ""}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-ink-soft">문의가 없어요</p>
      ) : (
        <ol className="space-y-3" aria-label="문의 목록">
          {items.map((f) => (
            <li key={f.id} className="space-y-3 rounded-2xl border border-line bg-surface p-4" data-admin-feedback={f.id}>
              <div className="flex flex-wrap items-center gap-2">
                <FeedbackStatusBadge status={f.status} />
                <span className="text-sm">{FEEDBACK_KIND_LABELS[f.kind]}</span>
                <h2 className="min-w-0 flex-1 font-bold [overflow-wrap:anywhere]">{f.title}</h2>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-ink-soft">쓴 사람</dt>
                <dd className="min-w-0 [overflow-wrap:anywhere]">
                  {f.username} {f.nickname && <span className="text-ink-soft">({f.nickname})</span>}
                </dd>
                <dt className="text-ink-soft">보낸 때</dt>
                <dd>{formatDateTime(f.createdAt)}</dd>
                <dt className="text-ink-soft">보던 화면</dt>
                <dd className="min-w-0 [overflow-wrap:anywhere]">{f.pagePath ?? "-"}</dd>
                <dt className="text-ink-soft">브라우저</dt>
                <dd className="min-w-0 text-ink-soft [overflow-wrap:anywhere]">{f.userAgent ?? "-"}</dd>
                {f.repliedAt && f.repliedBy && (
                  <>
                    <dt className="text-ink-soft">답한 때</dt>
                    <dd>
                      {formatDateTime(f.repliedAt)} ({BY[f.repliedBy]})
                    </dd>
                  </>
                )}
              </dl>
              {/* 글자로만 보여 준다 (HTML로 넣지 않음, NF-03) */}
              <p className="whitespace-pre-wrap rounded-xl bg-bg p-3 text-sm [overflow-wrap:anywhere]">{f.content}</p>
              <FeedbackAdminForm key={f.id} id={f.id} status={f.status} reply={f.reply} />
            </li>
          ))}
        </ol>
      )}
      <Pagination basePath="/admin/feedback" query={status ? { status } : {}} page={page} totalPages={Math.ceil(total / ADMIN_FEEDBACK_PAGE_SIZE)} />
    </div>
  );
}
