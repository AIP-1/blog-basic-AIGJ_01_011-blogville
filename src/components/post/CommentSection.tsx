"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { addComment, addReply, deleteComment, deleteReply, updateComment, updateReply, type CommentResult } from "@/app/blog/actions";
import { COMMENT_MAX, formatDateTime, SECRET_PLACEHOLDER } from "@/lib/comment-rules";
import { confirmFirst } from "@/lib/confirm-action";
import type { CommentLine, CommentThreadItem } from "@/server/comments";

type Props = { postId: number; items: CommentThreadItem[]; count: number; signedIn: boolean; loginHref: string };

/** 글 상세 아래 댓글 영역 (SOC-01·02). 주소는 `#comments`. `loginHref`는 로그인 뒤 이 자리로 돌아오는 첫 화면 주소. */
export function CommentSection({ postId, items, count, signedIn, loginHref }: Props) {
  return (
    <section id="comments" aria-labelledby="comments-title" className="mt-8 border-t border-line pt-6">
      <h2 id="comments-title" className="text-lg font-bold">
        💬 댓글 {count}
      </h2>
      <ul className="mt-4 space-y-4">
        {items.map((item) => (
          <CommentItem key={item.id} postId={postId} item={item} />
        ))}
      </ul>
      <div className="mt-6">
        {signedIn ? (
          <CommentForm
            send={(content, isSecret) => addComment(form({ postId, content, isSecret }))}
            placeholder="따뜻한 댓글을 남겨 주세요 💬"
            label="댓글"
            submitLabel="댓글 등록"
            rows={3}
          />
        ) : (
          <p className="text-ink-soft">
            <Link href={loginHref} className="inline-flex min-h-11 items-center font-semibold text-accent underline">
              로그인
            </Link>
            하면 댓글을 남길 수 있어요
          </p>
        )}
      </div>
    </section>
  );
}

function form(values: Record<string, string | number | boolean>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, String(v));
  return data;
}

function CommentItem({ postId, item }: { postId: number; item: CommentThreadItem }) {
  const [replying, setReplying] = useState(false);
  return (
    <li>
      <Line line={item} anchor={`comment-${item.id}`} remove={deleteComment} edit={updateComment}>
        {item.canReply && !replying && (
          <button type="button" className="btn btn-ghost px-2" onClick={() => setReplying(true)}>
            답글
          </button>
        )}
      </Line>
      {replying && (
        <div className="ml-10 mt-2">
          <CommentForm
            send={(content, isSecret) => addReply(form({ postId, commentId: item.id, content, isSecret }))}
            placeholder="답글을 남겨 주세요"
            label="답글"
            submitLabel="답글 등록"
            rows={2}
            onDone={() => setReplying(false)}
            onCancel={() => setReplying(false)}
            cancelLabel="답글 취소"
          />
        </div>
      )}
      {item.replies.length > 0 && (
        <ul aria-label="답글" className="ml-10 mt-3 space-y-3 border-l-2 border-line pl-4">
          {item.replies.map((reply) => (
            <li key={reply.id}>
              <Line line={reply} anchor={`reply-${reply.id}`} remove={deleteReply} edit={updateReply} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

type LineProps = {
  line: CommentLine;
  anchor: string;
  remove: (data: FormData) => Promise<void>;
  edit: (data: FormData) => Promise<CommentResult>;
  children?: React.ReactNode;
};

function Line({ line, anchor, remove, edit, children }: LineProps) {
  const [editing, setEditing] = useState(false);
  // 저장·취소하고 나면 [수정] 버튼으로 초점을 돌려준다 (키보드로 이어서 쓸 수 있게)
  const editButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  useEffect(() => {
    if (!editing && returnFocus.current) {
      returnFocus.current = false;
      editButton.current?.focus();
    }
  }, [editing]);
  const close = () => {
    returnFocus.current = true;
    setEditing(false);
  };

  return (
    // 옆 칸 `💬 최근 댓글`에서 `#comment-ID`·`#reply-ID`로 온다 (BLOG-09)
    <article id={anchor} className="scroll-mt-20" aria-label={line.deleted ? "삭제된 댓글" : `${line.nickname ?? "알 수 없음"}의 댓글`}>
      {/* 탈퇴한 회원의 자리는 닉네임·시각 없이 문구만 (AUTH-06) */}
      {!line.withdrawn && (
        <p className="flex flex-wrap items-center gap-x-2 text-sm">
          {line.authorSlug ? (
            <Link href={`/@${line.authorSlug}`} className="inline-flex min-h-11 items-center font-bold">
              {line.nickname}
            </Link>
          ) : (
            <span className="font-bold text-ink-soft">{line.nickname ?? "알 수 없음"}</span>
          )}
          <time dateTime={line.createdAt.toISOString()} className="text-ink-soft">
            {formatDateTime(line.createdAt)}
          </time>
          {line.editedAt && (
            <span className="text-ink-soft" title={`${formatDateTime(line.editedAt)}에 수정`}>
              (수정됨)
            </span>
          )}
          {/* 볼 수 있는 사람에게만: 비밀로 쓴 댓글이라는 표시 */}
          {line.secret && !line.hidden && !line.deleted && (
            <span className="text-ink-soft" aria-label="비밀 댓글">
              🔒
            </span>
          )}
        </p>
      )}
      {line.deleted ? (
        <p className="italic text-ink-soft">삭제된 댓글이에요</p>
      ) : line.hidden ? (
        // 내용은 서버가 비워 보낸다 (specs/055-comment-edit-secret)
        <p className="italic text-ink-soft">{SECRET_PLACEHOLDER}</p>
      ) : editing ? (
        <div className="mt-1">
          <CommentForm
            send={(content, isSecret) => edit(form({ id: line.id, content, isSecret }))}
            placeholder="댓글을 고쳐 주세요"
            label="댓글 수정"
            submitLabel="저장"
            pendingLabel="저장 중..."
            rows={3}
            initialContent={line.content}
            initialSecret={line.secret}
            autoFocus
            onDone={close}
            onCancel={close}
            cancelLabel="취소"
          />
        </div>
      ) : (
        // 글자로만 보여 준다 (HTML로 넣지 않음, NF-03)
        <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{line.content}</p>
      )}
      {!line.deleted && !editing && (children || line.canDelete || line.canEdit) && (
        <div className="mt-1 flex gap-1">
          {children}
          {line.canEdit && (
            <button ref={editButton} type="button" className="btn btn-ghost px-2" onClick={() => setEditing(true)}>
              수정
            </button>
          )}
          {line.canDelete && (
            <form action={confirmFirst("댓글을 삭제할까요?", remove)}>
              <input type="hidden" name="id" value={line.id} />
              <button type="submit" className="btn btn-ghost px-2 text-danger">
                삭제
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}

type FormProps = {
  send: (content: string, isSecret: boolean) => Promise<CommentResult>;
  placeholder: string;
  label: string;
  submitLabel: string;
  pendingLabel?: string;
  rows: number;
  /** 수정할 때: 지금 내용·비밀 여부를 채워 연다 */
  initialContent?: string;
  initialSecret?: boolean;
  autoFocus?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
};

/** 댓글·답글·수정 공용 입력칸. 실패하면 문구만 보이고 쓴 내용은 남는다. */
function CommentForm({
  send,
  placeholder,
  label,
  submitLabel,
  pendingLabel = "등록 중...",
  rows,
  initialContent = "",
  initialSecret = false,
  autoFocus,
  onDone,
  onCancel,
  cancelLabel,
}: FormProps) {
  const [content, setContent] = useState(initialContent);
  const [isSecret, setSecret] = useState(initialSecret);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await send(content, isSecret);
      if (result.ok) {
        setContent("");
        setSecret(false);
        setError(null);
        onDone?.();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        aria-label={label}
        placeholder={placeholder}
        className="field resize-y"
        rows={rows}
        maxLength={COMMENT_MAX}
        value={content}
        autoFocus={autoFocus}
        onChange={(e) => setContent(e.target.value)}
        // 수정 칸에서 Esc는 [취소]와 같다
        onKeyDown={autoFocus && onCancel ? (e) => e.key === "Escape" && onCancel() : undefined}
      />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {error && (
          <p role="alert" className="form-error mr-auto">
            {error}
          </p>
        )}
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" checked={isSecret} onChange={(e) => setSecret(e.target.checked)} />
          🔒 비밀 댓글
        </label>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            {cancelLabel}
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
