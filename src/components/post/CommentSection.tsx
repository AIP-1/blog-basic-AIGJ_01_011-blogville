"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addComment, addReply, deleteComment, deleteReply, type CommentResult } from "@/app/blog/actions";
import { COMMENT_MAX, formatDateTime } from "@/lib/comment-rules";
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
            send={(content) => addComment(form({ postId, content }))}
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

function form(values: Record<string, string | number>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, String(v));
  return data;
}

function CommentItem({ postId, item }: { postId: number; item: CommentThreadItem }) {
  const [replying, setReplying] = useState(false);
  return (
    <li>
      <Line line={item} anchor={`comment-${item.id}`} remove={deleteComment}>
        {item.canReply && !replying && (
          <button type="button" className="btn btn-ghost px-2" onClick={() => setReplying(true)}>
            답글
          </button>
        )}
      </Line>
      {replying && (
        <div className="ml-10 mt-2">
          <CommentForm
            send={(content) => addReply(form({ postId, commentId: item.id, content }))}
            placeholder="답글을 남겨 주세요"
            label="답글"
            submitLabel="답글 등록"
            rows={2}
            onDone={() => setReplying(false)}
            onCancel={() => setReplying(false)}
          />
        </div>
      )}
      {item.replies.length > 0 && (
        <ul aria-label="답글" className="ml-10 mt-3 space-y-3 border-l-2 border-line pl-4">
          {item.replies.map((reply) => (
            <li key={reply.id}>
              <Line line={reply} anchor={`reply-${reply.id}`} remove={deleteReply} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

type LineProps = { line: CommentLine; anchor: string; remove: (data: FormData) => Promise<void>; children?: React.ReactNode };

function Line({ line, anchor, remove, children }: LineProps) {
  return (
    // 옆 칸 `💬 최근 댓글`에서 `#comment-ID`·`#reply-ID`로 온다 (BLOG-09)
    <article id={anchor} className="scroll-mt-20" aria-label={line.deleted ? "삭제된 댓글" : `${line.nickname ?? "알 수 없음"}의 댓글`}>
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
      </p>
      {line.deleted ? (
        <p className="italic text-ink-soft">삭제된 댓글이에요</p>
      ) : (
        // 글자로만 보여 준다 (HTML로 넣지 않음, NF-03)
        <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{line.content}</p>
      )}
      {!line.deleted && (children || line.canDelete) && (
        <div className="mt-1 flex gap-1">
          {children}
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
  send: (content: string) => Promise<CommentResult>;
  placeholder: string;
  label: string;
  submitLabel: string;
  rows: number;
  onDone?: () => void;
  onCancel?: () => void;
};

/** 댓글·답글 공용 입력칸. 실패하면 문구만 보이고 쓴 내용은 남는다. */
function CommentForm({ send, placeholder, label, submitLabel, rows, onDone, onCancel }: FormProps) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await send(content);
      if (result.ok) {
        setContent("");
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
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {error && (
          <p role="alert" className="form-error mr-auto">
            {error}
          </p>
        )}
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            답글 취소
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "등록 중..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
