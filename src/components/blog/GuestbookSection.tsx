"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  addGuestbookEntry,
  deleteGuestbookEntry,
  deleteGuestbookReply,
  replyGuestbookEntry,
  updateGuestbookEntry,
} from "@/app/blog/guestbook-actions";
import { CommentForm } from "@/components/post/CommentSection";
import { formatDateTime } from "@/lib/comment-rules";
import { confirmFirst } from "@/lib/confirm-action";
import { GUESTBOOK_SECRET_PLACEHOLDER } from "@/lib/guestbook-rules";
import type { GuestbookEntry } from "@/server/guestbook";

type Props = {
  blogId: number;
  ownerNickname: string;
  items: GuestbookEntry[];
  signedIn: boolean;
  loginHref: string;
};

const SECRET_LABEL = "🔒 비밀글";

function form(values: Record<string, string | number | boolean>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, String(v));
  return data;
}

/** 방명록 입력칸과 목록 (BLOG-10, specs/056-guestbook). 권한·가림은 서버가 계산해 보낸다. */
export function GuestbookSection({ blogId, ownerNickname, items, signedIn, loginHref }: Props) {
  return (
    <>
      <section aria-label="방명록 쓰기" className="rounded-2xl border border-line bg-surface p-4">
        {signedIn ? (
          <CommentForm
            send={(content, isSecret) => addGuestbookEntry(form({ blogId, content, isSecret }))}
            placeholder="반가운 인사를 남겨 주세요 📖"
            label="방명록"
            submitLabel="방명록 남기기"
            rows={3}
            secretLabel={SECRET_LABEL}
          />
        ) : (
          <p className="text-ink-soft">
            <Link href={loginHref} className="inline-flex min-h-11 items-center font-semibold text-accent underline">
              로그인
            </Link>
            하면 방명록을 남길 수 있어요
          </p>
        )}
      </section>
      {items.length > 0 && (
        <ol aria-label="방명록 글" className="space-y-3">
          {items.map((entry) => (
            <li key={entry.id}>
              <Entry entry={entry} ownerNickname={ownerNickname} />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

/** 저장·취소하고 나면 그 버튼으로 초점을 돌려준다 (키보드로 이어서 쓸 수 있게) */
function useEditing() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  useEffect(() => {
    if (!open && returnFocus.current) {
      returnFocus.current = false;
      button.current?.focus();
    }
  }, [open]);
  const close = () => {
    returnFocus.current = true;
    setOpen(false);
  };
  return { open, setOpen, close, button };
}

function Entry({ entry, ownerNickname }: { entry: GuestbookEntry; ownerNickname: string }) {
  const { open: editing, setOpen: setEditing, close: closeEdit, button: editButton } = useEditing();
  const { open: replying, setOpen: setReplying, close: closeReply, button: replyButton } = useEditing();

  return (
    <article id={`entry-${entry.id}`} className="scroll-mt-20 rounded-2xl border border-line bg-surface p-4" aria-label={`${entry.nickname ?? "알 수 없음"}의 방명록`}>
      <p className="flex flex-wrap items-center gap-x-2 text-sm">
        {entry.authorSlug ? (
          <Link href={`/@${entry.authorSlug}`} className="inline-flex min-h-11 items-center font-bold">
            {entry.nickname}
          </Link>
        ) : (
          <span className="font-bold text-ink-soft">{entry.nickname ?? "알 수 없음"}</span>
        )}
        <time dateTime={entry.createdAt.toISOString()} className="text-ink-soft">
          {formatDateTime(entry.createdAt)}
        </time>
        {entry.editedAt && (
          <span className="text-ink-soft" title={`${formatDateTime(entry.editedAt)}에 수정`}>
            (수정됨)
          </span>
        )}
        {entry.secret && !entry.hidden && (
          <span className="text-ink-soft" aria-label="비밀글">
            🔒
          </span>
        )}
      </p>
      {entry.hidden ? (
        // 내용은 서버가 비워 보낸다
        <p className="italic text-ink-soft">{GUESTBOOK_SECRET_PLACEHOLDER}</p>
      ) : editing ? (
        <div className="mt-1">
          <CommentForm
            send={(content, isSecret) => updateGuestbookEntry(form({ id: entry.id, content, isSecret }))}
            placeholder="방명록을 고쳐 주세요"
            label="방명록 수정"
            submitLabel="저장"
            pendingLabel="저장 중..."
            rows={3}
            initialContent={entry.content}
            initialSecret={entry.secret}
            secretLabel={SECRET_LABEL}
            autoFocus
            onDone={closeEdit}
            onCancel={closeEdit}
            cancelLabel="취소"
          />
        </div>
      ) : (
        // 글자로만 보여 준다 (HTML로 넣지 않음, NF-03)
        <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{entry.content}</p>
      )}
      {!editing && !entry.hidden && (entry.canEdit || entry.canDelete || (entry.canReply && !entry.reply)) && (
        <div className="mt-1 flex flex-wrap gap-1">
          {entry.canReply && !entry.reply && !replying && (
            <button ref={replyButton} type="button" className="btn btn-ghost px-2" onClick={() => setReplying(true)}>
              답글
            </button>
          )}
          {entry.canEdit && (
            <button ref={editButton} type="button" className="btn btn-ghost px-2" onClick={() => setEditing(true)}>
              수정
            </button>
          )}
          {entry.canDelete && <DeleteButton id={entry.id} label="삭제" question="방명록 글을 삭제할까요?" action={deleteGuestbookEntry} />}
        </div>
      )}
      {/* 볼 수 없는 비밀 방명록에는 버튼이 없다 (볼 수 있는 작성자·주인·관리자만 고치거나 지운다) */}

      {(entry.reply || replying) && (
        <div className="ml-4 mt-3 border-l-2 border-line pl-4 sm:ml-8" aria-label="주인 답글">
          {entry.reply && !replying && (
            <>
              <p className="flex flex-wrap items-center gap-x-2 text-sm">
                <span className="font-bold">↳ {ownerNickname}</span>
                <time dateTime={entry.reply.repliedAt.toISOString()} className="text-ink-soft">
                  {formatDateTime(entry.reply.repliedAt)}
                </time>
                {entry.reply.editedAt && (
                  <span className="text-ink-soft" title={`${formatDateTime(entry.reply.editedAt)}에 수정`}>
                    (수정됨)
                  </span>
                )}
              </p>
              {entry.hidden ? (
                <p className="italic text-ink-soft">{GUESTBOOK_SECRET_PLACEHOLDER}</p>
              ) : (
                <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{entry.reply.content}</p>
              )}
              {!entry.hidden && (entry.canReply || entry.canDeleteReply) && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {entry.canReply && (
                    <button ref={replyButton} type="button" className="btn btn-ghost px-2" onClick={() => setReplying(true)}>
                      답글 수정
                    </button>
                  )}
                  {entry.canDeleteReply && <DeleteButton id={entry.id} label="답글 삭제" question="답글을 삭제할까요?" action={deleteGuestbookReply} />}
                </div>
              )}
            </>
          )}
          {replying && (
            <CommentForm
              send={(content) => replyGuestbookEntry(form({ id: entry.id, content }))}
              placeholder="답글을 남겨 주세요"
              label="방명록 답글"
              submitLabel={entry.reply ? "저장" : "답글 등록"}
              pendingLabel={entry.reply ? "저장 중..." : undefined}
              rows={2}
              initialContent={entry.reply?.content ?? ""}
              secretLabel={null}
              autoFocus
              onDone={closeReply}
              onCancel={closeReply}
              cancelLabel="답글 취소"
            />
          )}
        </div>
      )}
    </article>
  );
}

function DeleteButton({ id, label, question, action }: { id: number; label: string; question: string; action: (data: FormData) => Promise<void> }) {
  return (
    <form action={confirmFirst(question, action)}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn btn-ghost px-2 text-danger">
        {label}
      </button>
    </form>
  );
}
