"use client";

import { useState, useTransition, type ReactNode } from "react";
import type { AdminResult } from "@/lib/admin-rules";

type Props = {
  action: (formData: FormData) => Promise<AdminResult>;
  /** 있으면 보내기 전에 확인 창으로 묻는다 */
  confirm?: string;
  children: ReactNode;
  className?: string;
  label: string;
};

/**
 * 관리자 작업 폼: 확인은 폼 액션(클라이언트 함수) 안에서 묻고, 결과 문구를 폼 옆에 보인다.
 * 화면 준비 전 클릭·자바스크립트 없는 제출이 확인 없이 실행되지 않는다 (confirm-action.ts와 같은 이유).
 */
export function AdminActionForm({ action, confirm, children, className, label }: Props) {
  const [result, setResult] = useState<AdminResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      aria-label={label}
      aria-busy={pending}
      className={className}
      action={(formData) => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => setResult(await action(formData)));
      }}
    >
      {children}
      {result && (
        <p role={result.ok ? "status" : "alert"} className={`w-full text-sm ${result.ok ? "text-accent" : "text-danger"}`} data-admin-result>
          {result.ok ? result.message : result.error}
        </p>
      )}
    </form>
  );
}
