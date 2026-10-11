"use client";

import { deletePost } from "@/app/write/actions";

export function DeletePostButton({ postId }: { postId: number }) {
  return (
    <form
      action={deletePost}
      onSubmit={(e) => {
        if (!confirm("이 글을 지울까요? 지운 글은 되돌릴 수 없어요.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="postId" value={postId} />
      <button type="submit" className="btn btn-danger">
        삭제
      </button>
    </form>
  );
}
