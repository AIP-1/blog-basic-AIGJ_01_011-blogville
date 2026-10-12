"use client";

import { adminDeletePost } from "@/app/admin/actions";
import { confirmFirst } from "@/lib/confirm-action";

export function AdminDeleteButton({ postId, title }: { postId: number; title: string }) {
  return (
    <form action={confirmFirst(`'${title}' 글을 삭제할까요?`, adminDeletePost)}>
      <input type="hidden" name="postId" value={postId} />
      <button type="submit" className="btn btn-danger btn-ghost px-2" aria-label={`${title} 삭제`}>
        삭제
      </button>
    </form>
  );
}
