import type { Metadata } from "next";
import { Pagination } from "@/components/blog/Pagination";
import { ADMIN_PAGE_SIZE, AUDIT_ACTIONS, parseAuditAction, type AuditAction } from "@/lib/admin-rules";
import { formatDateTime } from "@/lib/comment-rules";
import { parsePage } from "@/lib/ids";
import { listAudit } from "@/server/admin-tools";
import { requireAdmin } from "@/server/dal";

export const metadata: Metadata = { title: "관리 기록 | 관리자 | Blogville" };

// 관리 기록 (ADM-06, specs/058-admin-tools): 관리자가 한 일을 최신순으로. 종류로 거른다 (`?action=suspend`)
export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin();
  const params = await searchParams;
  const action = parseAuditAction(params.action);
  const page = parsePage(params.page);
  const { items, total } = await listAudit({ action, page });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">📜 관리 기록</h1>
      <form method="get" action="/admin/audit" className="flex flex-wrap items-center gap-2">
        <label htmlFor="audit-action" className="font-semibold">
          종류
        </label>
        <select id="audit-action" name="action" defaultValue={action ?? ""} className="field field-auto">
          <option value="">전체</option>
          {(Object.keys(AUDIT_ACTIONS) as AuditAction[]).map((a) => (
            <option key={a} value={a}>
              {AUDIT_ACTIONS[a]}
            </option>
          ))}
        </select>
        <button type="submit" className="btn">
          거르기
        </button>
      </form>
      <p className="text-sm text-ink-soft">{total.toLocaleString("ko-KR")}건</p>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-5 text-ink-soft">기록이 없어요</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface px-4">
          {items.map((r) => (
            <li key={r.id} className="space-y-1 py-3 text-sm" data-audit={r.action} data-audit-target={r.targetId ?? ""}>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="rounded-full bg-accent/10 px-2 font-bold text-accent">{r.actionLabel}</span>
                <span className="font-semibold break-all">{r.targetLabel}</span>
                <span className="text-ink-soft">by {r.admin ?? "(탈퇴한 관리자)"}</span>
                <span className="text-ink-soft">{formatDateTime(r.createdAt)}</span>
              </p>
              {r.detail && <p className="break-words text-ink-soft">{r.detail}</p>}
            </li>
          ))}
        </ul>
      )}
      <Pagination basePath="/admin/audit" query={action ? { action } : {}} page={page} totalPages={Math.ceil(total / ADMIN_PAGE_SIZE)} />
    </div>
  );
}
