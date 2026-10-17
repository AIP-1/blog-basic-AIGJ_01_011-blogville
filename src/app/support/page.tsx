import type { Metadata } from "next";
import Link from "next/link";
import { Pagination } from "@/components/blog/Pagination";
import { PageHeader } from "@/components/layout/PageHeader";
import { FeedbackStatusBadge } from "@/components/support/FeedbackStatusBadge";
import { SupportForm } from "@/components/support/SupportForm";
import { formatDateTime } from "@/lib/time";
import { parsePage } from "@/lib/ids";
import { loginHref } from "@/lib/safe-next";
import { FEEDBACK_KIND_LABELS, FEEDBACK_PAGE_SIZE, feedbackPagePath } from "@/lib/support-rules";
import { getSession } from "@/server/dal";
import { listMyFeedback } from "@/server/feedback";

export const metadata: Metadata = { title: "버그·문의 | Blogville" };

// 버그·문의 (SUP-02, specs/057-support): 회원은 버그·문의를 보내고 아래 `내 문의`에서 처리 상태와 답변을 본다.
// 방문자는 로그인하면 이 화면(보던 주소 `?from=` 포함)으로 돌아온다.
export default async function SupportPage({ searchParams }: PageProps<"/support">) {
  const params = await searchParams;
  const from = feedbackPagePath(params.from);
  const page = parsePage(params.page);
  const member = await getSession();
  const here = from ? `/support?from=${encodeURIComponent(from)}` : "/support";
  const mine = member ? await listMyFeedback(member.userId, page) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader emoji="🐞" title="버그·문의" mark="letter" description="고장 난 곳이나 궁금한 점을 알려 주세요. 답변은 알림으로 알려 드려요." />

      <section aria-label="문의 쓰기" className="rounded-2xl border border-line bg-surface p-5">
        {member ? (
          <SupportForm from={from} />
        ) : (
          <p className="text-ink-soft">
            <Link href={loginHref(here)} className="inline-flex min-h-11 items-center font-semibold text-accent underline" data-support-login>
              로그인
            </Link>
            하면 버그·문의를 보낼 수 있어요
          </p>
        )}
      </section>

      {mine && (
        <section aria-labelledby="my-feedback" className="space-y-3">
          <h2 id="my-feedback" className="text-lg font-bold">
            내 문의 <span className="text-ink-soft">{mine.total}</span>
          </h2>
          {mine.items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-6 text-center text-ink-soft">아직 보낸 문의가 없어요</p>
          ) : (
            <ol className="space-y-3" aria-label="내 문의 목록">
              {mine.items.map((f) => (
                <li key={f.id} className="space-y-2 rounded-2xl border border-line bg-surface p-4" data-feedback={f.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <FeedbackStatusBadge status={f.status} />
                    <span className="text-sm">{FEEDBACK_KIND_LABELS[f.kind]}</span>
                    <h3 className="min-w-0 flex-1 font-bold [overflow-wrap:anywhere]">{f.title}</h3>
                    <time dateTime={f.createdAt.toISOString()} className="text-sm text-ink-soft">
                      {formatDateTime(f.createdAt)}
                    </time>
                  </div>
                  {/* 글자로만 보여 준다 (HTML로 넣지 않음, NF-03) */}
                  <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{f.content}</p>
                  {f.reply && (
                    <div className="rounded-xl bg-bg p-3 text-sm" data-feedback-reply>
                      <p className="mb-1 font-semibold">
                        💌 답변
                        {f.repliedAt && <span className="ml-2 font-normal text-ink-soft">{formatDateTime(f.repliedAt)}</span>}
                      </p>
                      <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{f.reply}</p>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
          <Pagination basePath="/support" query={from ? { from } : {}} page={page} totalPages={Math.ceil(mine.total / FEEDBACK_PAGE_SIZE)} />
        </section>
      )}
    </div>
  );
}
