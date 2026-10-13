"use client";

import { signOut } from "@/app/(auth)/actions";
import { clearDraft } from "@/lib/draft";

/** 로그아웃하면 이 브라우저에 남은 그 회원의 임시 글도 지운다 (POST-08) */
export function SignOutButton({ userId }: { userId: string }) {
  return (
    <form action={signOut}>
      <button type="submit" className="btn btn-ghost text-ink-soft" onClick={() => clearDraft(userId)}>
        로그아웃
      </button>
    </form>
  );
}
