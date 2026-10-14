"use client";

import { useLinkStatus } from "next/link";

/** 링크를 누른 뒤 새 화면을 받는 동안 작은 빙글이 (자리는 늘 잡아 두고 보였다 숨겼다만) */
export function PendingHint() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      data-pending={pending || undefined}
      className={`ml-1 inline-block size-3 shrink-0 rounded-full border-2 border-current border-t-transparent transition-opacity ${pending ? "animate-spin opacity-70" : "opacity-0"}`}
    />
  );
}
