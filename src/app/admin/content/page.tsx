import type { Metadata } from "next";
import Link from "next/link";
import { adminBlindPost, adminUnblindPost } from "@/app/admin/tools-actions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { BulkDeleteForm } from "@/components/admin/BulkDeleteForm";
import { Pagination } from "@/components/blog/Pagination";
import { ADMIN_PAGE_SIZE, CONTENT_TAB_LABELS, CONTENT_TABS, parseContentTab, REASON_MAX, snippet, type ContentTab } from "@/lib/admin-rules";
import { formatDateTime } from "@/lib/comment-rules";
import { parsePage } from "@/lib/ids";
import { listCommentsForAdmin, listGuestbookForAdmin, listPostsForAdmin } from "@/server/admin-tools";
import { requireAdmin } from "@/server/dal";

export const metadata: Metadata = { title: "콘텐츠 | 관리자 | Blogville" };

const FORM_ID = "admin-bulk-delete";

/** 줄 맨 앞의 선택 상자. 폼 밖에 있어도 `form` 속성으로 [선택 삭제] 폼에 묶인다 */
function Pick({ value, label }: { value: string; label: string }) {
  return (
    <label className="flex size-11 shrink-0 items-center justify-center">
      <input type="checkbox" name="items" value={value} form={FORM_ID} className="size-5" aria-label={`${label} 선택`} />
    </label>
  );
}

function Author({ nickname, username }: { nickname: string | null; username: string | null }) {
  return <span>{username ? `${nickname ?? "-"} (${username})` : "탈퇴한 회원"}</span>;
}

// 콘텐츠 관리 (ADM-02, specs/058-admin-tools): 글 / 댓글·답글 / 방명록을 최신순으로 보고 골라 지운다.
// 비밀 댓글·방명록도 관리자에게는 내용을 보인다 (관리자는 비밀 글을 볼 수 있다). 비공개 글은 관리자에게도 링크가 없다 (글 화면이 404).
export default async function AdminContentPage({ searchParams }: PageProps<"/admin/content">) {
  await requireAdmin();
  const params = await searchParams;
  const tab = parseContentTab(params.tab);
  const page = parsePage(params.page);
  const keep: Record<string, string> = tab === "posts" ? {} : { tab };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">📝 콘텐츠 관리</h1>
      <nav aria-label="콘텐츠 종류" className="flex flex-wrap gap-1">
        {CONTENT_TABS.map((t) => (
          <Link
            key={t}
            href={t === "posts" ? "/admin/content" : `/admin/content?tab=${t}`}
            aria-current={t === tab ? "page" : undefined}
            className={`btn ${t === tab ? "btn-current" : ""}`}
          >
            {CONTENT_TAB_LABELS[t]}
          </Link>
        ))}
      </nav>
      <BulkDeleteForm key={tab} id={FORM_ID} tab={tab} />
      <ContentList tab={tab} page={page} keep={keep} />
    </div>
  );
}

async function ContentList({ tab, page, keep }: { tab: ContentTab; page: number; keep: Record<string, string> }) {
  const empty = <p className="rounded-2xl border border-line bg-surface p-5 text-ink-soft">아직 없어요</p>;
  const row = "flex items-start gap-2 py-2 text-sm";

  if (tab === "posts") {
    const { items, total } = await listPostsForAdmin(page);
    return (
      <>
        {items.length === 0 ? (
          empty
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface px-3">
            {items.map((p) => (
              <li key={p.id} className={row} data-admin-content={`post:${p.id}`}>
                <Pick value={`post:${p.id}`} label={p.title} />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-x-2">
                    {p.isPublic ? (
                      <Link href={`/@${p.slug}/${p.id}`} className="flex min-h-11 items-center font-semibold underline">
                        {p.title}
                      </Link>
                    ) : (
                      <span className="font-semibold">{p.title}</span>
                    )}
                    <span>{p.isPublic ? "공개" : "🔒 비공개"}</span>
                    {p.blindedAt && <span className="rounded-full bg-danger/10 px-2 font-bold text-danger">🚫 블라인드</span>}
                  </p>
                  <p className="break-words text-ink-soft">{snippet(p.text, 100)}</p>
                  <p className="flex flex-wrap gap-x-3 text-ink-soft">
                    <Author nickname={p.nickname} username={p.username} />
                    <Link href={`/@${p.slug}`} className="underline">
                      📖 {p.blogTitle}
                    </Link>
                    <span>{formatDateTime(p.createdAt)}</span>
                  </p>
                  {p.blindedAt ? (
                    <AdminActionForm
                      action={adminUnblindPost}
                      label="블라인드 해제"
                      confirm={`'${p.title}' 글의 블라인드를 풀까요? 글은 비공개로 남아요.`}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="postId" value={p.id} />
                      <span className="text-ink-soft">사유: {p.blindReason}</span>
                      <button type="submit" className="btn">
                        블라인드 해제
                      </button>
                    </AdminActionForm>
                  ) : (
                    <details>
                      <summary className="flex min-h-11 cursor-pointer items-center text-ink-soft">블라인드</summary>
                      <AdminActionForm
                        action={adminBlindPost}
                        label="글 블라인드"
                        confirm={`'${p.title}' 글을 가릴까요? 작성자만 볼 수 있게 돼요.`}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="postId" value={p.id} />
                        <label className="sr-only" htmlFor={`blind-${p.id}`}>
                          블라인드 사유
                        </label>
                        <input
                          id={`blind-${p.id}`}
                          name="reason"
                          required
                          maxLength={REASON_MAX}
                          placeholder="사유 (작성자에게 보여요)"
                          className="field min-w-0 flex-1"
                        />
                        <button type="submit" className="btn btn-danger">
                          가리기
                        </button>
                      </AdminActionForm>
                    </details>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination basePath="/admin/content" query={keep} page={page} totalPages={Math.ceil(total / ADMIN_PAGE_SIZE)} />
      </>
    );
  }

  if (tab === "comments") {
    const { items, total } = await listCommentsForAdmin(page);
    return (
      <>
        {items.length === 0 ? (
          empty
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface px-3">
            {items.map((c) => {
              const kindLabel = c.kind === "comment" ? "댓글" : "답글";
              return (
                <li key={`${c.kind}:${c.id}`} className={row} data-admin-content={`${c.kind}:${c.id}`}>
                  <Pick value={`${c.kind}:${c.id}`} label={`${kindLabel} ${snippet(c.content, 20)}`} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="break-words">
                      <span className="mr-1 rounded-full bg-bg px-2 text-xs font-bold">{kindLabel}</span>
                      {c.isSecret && <span className="mr-1">🔒</span>}
                      {c.content}
                    </p>
                    <p className="flex flex-wrap gap-x-3 text-ink-soft">
                      <Author nickname={c.nickname} username={c.username} />
                      {c.postPublic ? (
                        <Link href={`/@${c.blogSlug}/${c.postId}#comments`} className="underline">
                          {c.postTitle}
                        </Link>
                      ) : (
                        <span>🔒 {c.postTitle}</span>
                      )}
                      <span>{formatDateTime(c.createdAt)}</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination basePath="/admin/content" query={keep} page={page} totalPages={Math.ceil(total / ADMIN_PAGE_SIZE)} />
      </>
    );
  }

  const { items, total } = await listGuestbookForAdmin(page);
  return (
    <>
      {items.length === 0 ? (
        empty
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface px-3">
          {items.map((g) => (
            <li key={g.id} className={row} data-admin-content={`guestbook:${g.id}`}>
              <Pick value={`guestbook:${g.id}`} label={`방명록 ${snippet(g.content, 20)}`} />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="break-words">
                  {g.isSecret && <span className="mr-1">🔒</span>}
                  {g.content}
                </p>
                {g.reply && <p className="break-words text-ink-soft">↳ 주인 답글: {snippet(g.reply, 100)}</p>}
                <p className="flex flex-wrap gap-x-3 text-ink-soft">
                  <Author nickname={g.nickname} username={g.username} />
                  <Link href={`/@${g.slug}/guestbook`} className="underline">
                    📖 {g.blogTitle} 방명록
                  </Link>
                  <span>{formatDateTime(g.createdAt)}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination basePath="/admin/content" query={keep} page={page} totalPages={Math.ceil(total / ADMIN_PAGE_SIZE)} />
    </>
  );
}
