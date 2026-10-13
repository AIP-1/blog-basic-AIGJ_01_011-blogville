"use client";

import { useRef, useState, useTransition } from "react";
import { adminDeleteContent } from "@/app/admin/tools-actions";
import type { AdminResult, ContentTab } from "@/lib/admin-rules";

/**
 * 콘텐츠 선택 삭제 (ADM-02): 줄마다 있는 `items` 체크 상자(`form={id}`로 이 폼에 묶임)로 고르고 [선택 삭제]. 몇 개인지 확인 창으로 묻는다.
 * 체크 상자를 폼 밖 목록에 두어, 줄마다 다른 폼(블라인드 등)을 둘 수 있다.
 * 확인은 폼 액션 안에서 묻는다 (화면 준비 전 클릭·자바스크립트 없는 제출이 확인 없이 실행되지 않게).
 */
export function BulkDeleteForm({ id, tab }: { id: string; tab: ContentTab }) {
  const ref = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<AdminResult | null>(null);
  const [pending, start] = useTransition();
  const toggleAll = (checked: boolean) => {
    for (const el of Array.from(ref.current?.elements ?? [])) if (el instanceof HTMLInputElement && el.name === "items") el.checked = checked;
  };
  return (
    <form
      ref={ref}
      id={id}
      aria-label="선택 삭제"
      aria-busy={pending}
      className="flex flex-wrap items-center gap-3 rounded-xl bg-surface p-2"
      action={(formData) => {
        const n = formData.getAll("items").length;
        if (n === 0) {
          setResult({ ok: false, error: "지울 항목을 골라 주세요" });
          return;
        }
        if (!window.confirm(`선택한 ${n}개를 삭제할까요? 되돌릴 수 없어요.`)) return;
        start(async () => {
          const r = await adminDeleteContent(formData);
          setResult(r);
          if (r.ok) toggleAll(false);
        });
      }}
    >
      <input type="hidden" name="tab" value={tab} />
      <label className="flex min-h-11 items-center gap-2 font-semibold">
        <input type="checkbox" className="size-5" onChange={(e) => toggleAll(e.target.checked)} />이 쪽 모두 선택
      </label>
      <button type="submit" className="btn btn-danger" disabled={pending}>
        {pending ? "삭제 중..." : "선택 삭제"}
      </button>
      {result && (
        <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-accent" : "text-danger"}`} data-admin-result>
          {result.ok ? result.message : result.error}
        </p>
      )}
    </form>
  );
}
