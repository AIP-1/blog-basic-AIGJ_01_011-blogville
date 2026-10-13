"use client";

import { deletePost } from "@/app/write/actions";
import { confirmFirst } from "@/lib/confirm-action";

export function DeletePostButton({ postId }: { postId: number }) {
  return (
    <form action={confirmFirst("이 글을 삭제할까요? 댓글과 공감도 함께 지워져요.", deletePost)}>
      <input type="hidden" name="postId" value={postId} />
      <button type="submit" className="btn btn-danger">
        삭제
      </button>
    </form>
  );
}
