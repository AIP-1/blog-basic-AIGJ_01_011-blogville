"use client";

import { deleteComment, deleteReply } from "@/app/blog/actions";
import { confirmFirst } from "@/lib/confirm-action";

/** 댓글 관리 한 줄의 [삭제]. 글 상세의 [삭제]와 같은 액션·확인 창을 쓴다 (SOC-01) */
export function CommentRowDelete({ kind, id, label }: { kind: "comment" | "reply"; id: number; label: string }) {
  return (
    <form action={confirmFirst("댓글을 삭제할까요?", kind === "comment" ? deleteComment : deleteReply)}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn btn-ghost px-3 text-danger" aria-label={label}>
        삭제
      </button>
    </form>
  );
}
