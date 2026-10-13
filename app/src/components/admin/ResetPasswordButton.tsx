"use client";

import { useState } from "react";
import { adminResetPassword } from "@/app/admin/actions";

/**
 * 관리자 [비밀번호 초기화] (AUTH-07 열린 질문). 확인 뒤 임시 비밀번호를 이 화면에 한 번만 보인다.
 * 확인은 폼 액션(클라이언트 함수) 안에서 묻는다 (화면 준비 전 클릭·자바스크립트 없는 제출이 확인 없이 실행되지 않게).
 */
export function ResetPasswordButton({ userId, username }: { userId: string; username: string }) {
  const [result, setResult] = useState<{ password?: string; error?: string } | null>(null);
  return (
    <div className="space-y-2">
      <form
        action={async (formData) => {
          if (!window.confirm(`${username} 회원의 비밀번호를 초기화할까요? 그 회원은 모든 기기에서 로그아웃돼요.`)) return;
          const r = await adminResetPassword(formData);
          setResult(r.ok ? { password: r.password } : { error: r.error });
        }}
      >
        <input type="hidden" name="userId" value={userId} />
        <button type="submit" className="btn btn-danger">
          비밀번호 초기화
        </button>
      </form>
      {result?.error && (
        <p role="alert" className="form-error">
          {result.error}
        </p>
      )}
      {result?.password && (
        <div role="status" className="notice-yellow rounded-xl p-3 text-sm">
          <p>
            임시 비밀번호: <code className="select-all rounded bg-surface px-2 py-1 text-base font-bold" data-temp-password>{result.password}</code>
          </p>
          <p className="mt-1">회원에게 전해 주세요. 로그인한 뒤 👤 내 정보에서 바꾸라고 알려 주세요. 이 화면을 떠나면 다시 볼 수 없어요.</p>
        </div>
      )}
    </div>
  );
}
