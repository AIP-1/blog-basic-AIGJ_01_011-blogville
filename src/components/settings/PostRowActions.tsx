"use client";

import Link from "next/link";
import { changeVisibility, removePost } from "@/app/settings/posts/actions";

/** 글 관리 한 줄의 [수정] [공개로/비공개로] [삭제] (BLOG-08) */
export function PostRowActions({ postId, title, isPublic }: { postId: number; title: string; isPublic: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Link href={`/write/${postId}`} className="btn btn-ghost px-3" aria-label={`${title} 수정`}>
        수정
      </Link>
      <form action={changeVisibility}>
        <input type="hidden" name="postId" value={postId} />
        <input type="hidden" name="to" value={isPublic ? "private" : "public"} />
        <button type="submit" className="btn btn-ghost px-3" aria-label={`${title} ${isPublic ? "비공개로" : "공개로"}`}>
          {isPublic ? "🔒 비공개로" : "🌐 공개로"}
        </button>
      </form>
      <form
        action={removePost}
        onSubmit={(e) => {
          if (!confirm("이 글을 지울까요? 지운 글은 되돌릴 수 없어요.")) e.preventDefault();
        }}
      >
        <input type="hidden" name="postId" value={postId} />
        <button type="submit" className="btn btn-ghost px-3 text-danger" aria-label={`${title} 삭제`}>
          삭제
        </button>
      </form>
    </div>
  );
}
