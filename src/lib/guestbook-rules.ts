import { canSeeSecret } from "./comment-rules";

// 방명록 규칙 (BLOG-10, specs/056-guestbook). 내용 규칙(1~1000자)은 댓글과 같아 `checkComment`를 쓴다.
// 브라우저와 서버가 같이 쓴다.

/** 한 쪽에 보이는 방명록 글 수 (`?page=`) */
export const GUESTBOOK_PAGE_SIZE = 10;

export const GUESTBOOK_ERRORS = {
  invalid: "잘못된 요청이에요",
  blogNotFound: "블로그를 찾을 수 없어요",
  editNotFound: "수정할 수 있는 방명록 글이 없어요",
  replyNotFound: "답글을 달 방명록 글이 없어요",
} as const;

/** 비밀 방명록을 볼 수 없는 사람에게 내용 대신 보이는 한 줄 */
export const GUESTBOOK_SECRET_PLACEHOLDER = "🔒 비밀 방명록이에요";

/**
 * 방명록 글이 가려지는지: 비밀이고 작성자·블로그 주인·관리자가 아니면.
 * 주인의 답글도 글을 따른다 (가려진 글의 답글도 가려진다).
 */
export function isEntryHidden(
  viewer: { userId: string; role: string } | null,
  blogOwnerId: string,
  entry: { authorId: string; isSecret: boolean },
): boolean {
  return entry.isSecret && !canSeeSecret(viewer, blogOwnerId, [entry.authorId]);
}

/** 방명록 주소 (`/@주소/guestbook`, 쪽이 1보다 크면 `?page=N`) */
export function guestbookPath(slug: string, page = 1): string {
  return page > 1 ? `/@${slug}/guestbook?page=${page}` : `/@${slug}/guestbook`;
}
