import type { Metadata } from "next";
import Link from "next/link";
import { adminReportBlind, adminReportDelete, adminReportDismiss } from "@/app/admin/reports-actions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { Pagination } from "@/components/blog/Pagination";
import { ADMIN_PAGE_SIZE, REASON_MAX, snippet } from "@/lib/admin-rules";
import { formatDateTime } from "@/lib/time";
import { parsePage } from "@/lib/ids";
import { REPORT_REASON_LABELS, REPORT_TARGET_LABELS, summarizeReasons, type ReportReason } from "@/lib/report-rules";
import { requireAdmin } from "@/server/dal";
import { listOpenReports, type ReportGroup } from "@/server/reports";

export const metadata: Metadata = { title: "신고 | 관리자 | Blogville" };

// 🚨 신고 처리 (specs/059-report-bookmarks): 처리하지 않은 신고를 대상별로 묶어 최근 신고 순으로 본다.
// 블라인드(글만)·삭제는 콘텐츠 관리와 같고, 처리하면 그 대상의 신고가 모두 닫힌다. 기각은 신고만 닫는다. 모두 관리 기록에 남는다.
export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requireAdmin();
  const page = parsePage((await searchParams).page);
  const { items, total } = await listOpenReports(page);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">🚨 신고</h1>
      <p className="text-sm text-ink-soft">
        처리하지 않은 신고 대상 <span data-report-targets={total}>{total.toLocaleString("ko-KR")}개</span> · 블라인드·삭제·기각하면 그 대상의 신고가 모두 닫히고 목록에서 빠져요
      </p>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-5 text-ink-soft">처리할 신고가 없어요</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface px-3">
          {items.map((g) => (
            <ReportRow key={`${g.targetType}:${g.targetId}`} group={g} />
          ))}
        </ul>
      )}
      <Pagination basePath="/admin/reports" query={{}} page={page} totalPages={Math.ceil(total / ADMIN_PAGE_SIZE)} />
    </div>
  );
}

function ReportRow({ group: g }: { group: ReportGroup }) {
  const kind = REPORT_TARGET_LABELS[g.targetType];
  const target = (
    <>
      <input type="hidden" name="targetType" value={g.targetType} />
      <input type="hidden" name="targetId" value={g.targetId} />
    </>
  );
  const name = g.title ? `'${snippet(g.title, 30)}'` : `${kind} #${g.targetId}`;
  const topReason = g.reasons[0] as ReportReason | undefined;
  return (
    <li className="space-y-2 py-3 text-sm" data-report-group={`${g.targetType}:${g.targetId}`}>
      <p className="flex flex-wrap items-center gap-x-2">
        <span className="rounded-full bg-bg px-2 text-xs font-bold">{kind}</span>
        <span className="rounded-full bg-danger/10 px-2 font-bold text-danger" data-report-count={g.count}>
          신고 {g.count}건
        </span>
        <span className="text-ink-soft">{summarizeReasons(g.reasons)}</span>
        <span className="text-ink-soft">· 최근 {formatDateTime(g.lastAt)}</span>
      </p>
      {g.exists ? (
        <>
          <p className="break-words">
            {g.isSecret && <span className="mr-1">🔒</span>}
            {g.targetType === "post" && <span className="mr-1 font-semibold">{g.title}</span>}
            <span className="text-ink-soft">{snippet(g.text, 120)}</span>
            {g.blinded && <span className="ml-1 rounded-full bg-danger/10 px-2 font-bold text-danger">🚫 블라인드</span>}
          </p>
          <p className="flex flex-wrap gap-x-3 text-ink-soft">
            <span>{g.author.username ? `${g.author.nickname ?? "-"} (${g.author.username})` : "탈퇴한 회원"}</span>
            {g.link ? (
              <Link href={g.link} className="underline">
                {g.targetType === "post" ? "글 보기" : `${g.title ?? ""}에서 보기`}
              </Link>
            ) : (
              <span>🔒 {g.title}</span>
            )}
          </p>
        </>
      ) : (
        <p className="italic text-ink-soft">이미 지워진 {kind}이에요</p>
      )}
      {g.details.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-ink-soft" aria-label="기타 사유 설명">
          {g.details.slice(0, 5).map((d, i) => (
            <li key={i} className="break-words">
              {REPORT_REASON_LABELS.other}: {d}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-start gap-2">
        {g.exists && g.targetType === "post" && !g.blinded && (
          <details>
            <summary className="btn cursor-pointer">블라인드</summary>
            <AdminActionForm action={adminReportBlind} label="신고된 글 블라인드" confirm={`${name} 글을 가릴까요? 작성자만 볼 수 있게 돼요.`} className="mt-2 flex flex-wrap items-center gap-2">
              {target}
              <label className="sr-only" htmlFor={`report-blind-${g.targetId}`}>
                블라인드 사유
              </label>
              <input
                id={`report-blind-${g.targetId}`}
                name="reason"
                required
                maxLength={REASON_MAX}
                defaultValue={topReason ? `신고: ${REPORT_REASON_LABELS[topReason]}` : ""}
                className="field min-w-0 flex-1"
              />
              <button type="submit" className="btn btn-danger">
                가리기
              </button>
            </AdminActionForm>
          </details>
        )}
        {g.exists && (
          <AdminActionForm action={adminReportDelete} label={`신고된 ${kind} 삭제`} confirm={`${name} ${kind}을 삭제할까요? 되돌릴 수 없어요.`}>
            {target}
            <button type="submit" className="btn btn-danger">
              삭제
            </button>
          </AdminActionForm>
        )}
        <AdminActionForm action={adminReportDismiss} label={`${kind} 신고 기각`} confirm={g.exists ? `${name}에 대한 신고 ${g.count}건을 기각할까요?` : undefined}>
          {target}
          <button type="submit" className="btn">
            {g.exists ? "기각" : "정리"}
          </button>
        </AdminActionForm>
      </div>
    </li>
  );
}
