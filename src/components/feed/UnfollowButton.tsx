"use client";

import { useRef } from "react";
import { removeNeighbor } from "@/app/blog/actions";

/**
 * 내 이웃 목록의 [✓ 이웃]: `이웃을 취소할까요?` 확인 뒤 취소 (SOC-04).
 * 확인은 폼 액션(클라이언트 함수) 안에서 묻는다. 서버 액션을 폼에 바로 달면 화면이 준비되기 전의 클릭이나
 * 자바스크립트 없는 제출이 확인 없이 지워 버린다. 지운 뒤에는 초점을 옆 줄의 [✓ 이웃](없으면 목록 제목)으로 옮긴다.
 */
export function UnfollowButton({ followeeId, describedBy }: { followeeId: string; describedBy: string }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={form}
      action={async (formData) => {
        if (!confirm("이웃을 취소할까요?")) return;
        const row = form.current?.closest("li");
        const nextFocus =
          (row?.nextElementSibling ?? row?.previousElementSibling)?.querySelector<HTMLElement>("button") ??
          row?.closest("details")?.querySelector<HTMLElement>("summary");
        await removeNeighbor(formData);
        nextFocus?.focus();
      }}
    >
      <input type="hidden" name="followeeId" value={followeeId} />
      <button type="submit" className="btn whitespace-nowrap" aria-pressed="true" aria-describedby={describedBy}>
        ✓ 이웃
      </button>
    </form>
  );
}
