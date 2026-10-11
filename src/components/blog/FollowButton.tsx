import { toggleFollow } from "@/app/blog/actions";

/**
 * 이웃 추가·취소 버튼 (SOC-04). 다른 회원의 블로그 홈에만 둔다.
 * 서버 처리가 끝난 뒤 다시 그려져 버튼과 `이웃 N`이 바뀐다 (미리 바꾸지 않는다).
 */
export function FollowButton({ ownerId, following }: { ownerId: string; following: boolean }) {
  return (
    <form action={toggleFollow}>
      <input type="hidden" name="followeeId" value={ownerId} />
      <button type="submit" className={`btn whitespace-nowrap ${following ? "" : "btn-sky"}`} aria-pressed={following}>
        {following ? "✓ 이웃" : "+ 이웃 추가"}
      </button>
    </form>
  );
}
