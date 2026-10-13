"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** 시험 오류 만들기: /admin/errors/test에 POST (서버가 일부러 던진다) → 기록된 목록을 다시 불러온다 */
export function TestErrorButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await fetch("/admin/errors/test", { method: "POST" }).catch(() => null);
            setMessage(res && res.status === 500 ? "시험 오류를 만들었어요" : "시험 오류를 만들지 못했어요");
            router.refresh();
          })
        }
      >
        시험 오류 만들기
      </button>
      {message && (
        <p role="status" className="text-sm text-ink-soft" data-test-error-result>
          {message}
        </p>
      )}
    </div>
  );
}
