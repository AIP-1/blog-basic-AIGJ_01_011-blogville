"use client";

import { removeNeighbor } from "@/app/blog/actions";

/** 내 이웃 목록의 [✓ 이웃]: `이웃을 취소할까요?` 확인 뒤 취소 (SOC-04) */
export function UnfollowButton({ followeeId, describedBy }: { followeeId: string; describedBy: string }) {
  return (
    <form
      action={removeNeighbor}
      onSubmit={(e) => {
        if (!confirm("이웃을 취소할까요?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="followeeId" value={followeeId} />
      <button type="submit" className="btn whitespace-nowrap" aria-pressed="true" aria-describedby={describedBy}>
        ✓ 이웃
      </button>
    </form>
  );
}
