"use client";

import { adminDeletePost, adminDeletePostAndLeave } from "@/app/admin/actions";
import { confirmFirst } from "@/lib/confirm-action";

/** 관리자 글 삭제. `leave`면 글 화면의 버튼: 지운 뒤 그 블로그 홈으로 간다. */
export function AdminDeleteButton({ postId, title, leave = false }: { postId: number; title: string; leave?: boolean }) {
  return (
    <form action={confirmFirst(`'${title}' 글을 삭제할까요?`, leave ? adminDeletePostAndLeave : adminDeletePost)}>
      <input type="hidden" name="postId" value={postId} />
      <button type="submit" className={leave ? "btn btn-danger" : "btn btn-danger btn-ghost px-2"} aria-label={`${title} 삭제`}>
        삭제
      </button>
    </form>
  );
}
