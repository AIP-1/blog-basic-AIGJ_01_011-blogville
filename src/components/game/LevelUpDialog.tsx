"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { dismissLevelUp } from "@/app/notifications/actions";
import { levelUpTitle } from "@/lib/notifications";

/**
 * 레벨업 팝업 (GAME-06). 처음 값은 서버가 헤더를 그릴 때 준다(`pending`, 그릴 때마다 새 객체).
 * 헤더(레이아웃)는 화면을 옮겨도 다시 그려지지 않으므로 주소가 바뀔 때마다 안 읽은 레벨업을 새로 받는다
 * (남이 공감해 줘서 오른 레벨은 다음에 여는 화면에서 뜬다).
 * 누르면 서버 응답을 기다리지 않고 바로 닫고, 닫은 레벨 이하는 다시 띄우지 않는다.
 */
export function LevelUpDialog({ pending }: { pending: { level: number | null } }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const ok = useRef<HTMLButtonElement>(null);
  const dismissed = useRef(0);
  const [level, setLevel] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const offer = (next: number | null) => {
    if (next !== null && next > dismissed.current) setLevel((cur) => (cur === null || next > cur ? next : cur));
  };

  useEffect(() => {
    offer(pending.level);
  }, [pending]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let alive = true;
    fetch("/api/notifications/unread", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { levelUp?: unknown } | null) => {
        if (alive && typeof data?.levelUp === "number") offer(data.levelUp);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  useEffect(() => {
    const el = dialog.current;
    if (level === null || !el || el.open) return;
    el.showModal();
    ok.current?.focus();
  }, [level]);

  const close = (go: "stay" | "wallet") => {
    if (level === null) return;
    dismissed.current = Math.max(dismissed.current, level);
    dialog.current?.close();
    setLevel(null);
    const data = new FormData();
    data.set("level", String(level));
    data.set("go", go);
    startTransition(() => dismissLevelUp(data));
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="level-up-title"
      className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-6 text-center text-ink backdrop:bg-black/50"
      onCancel={(e) => {
        // Esc는 [확인]과 같다
        e.preventDefault();
        close("stay");
      }}
      data-level-up={level ?? undefined}
    >
      {level !== null && (
        <>
          <p className="text-5xl" aria-hidden="true">
            🎉
          </p>
          <h2 id="level-up-title" className="mt-3 text-2xl font-extrabold">
            {levelUpTitle(level)}
          </h2>
          <p className="mt-2 text-ink-soft">활동하면서 경험치를 모았어요.</p>
          <div className="mt-6 flex justify-center gap-2">
            <button type="button" className="btn" onClick={() => close("wallet")}>
              내역 보기
            </button>
            <button type="button" ref={ok} className="btn btn-primary" onClick={() => close("stay")}>
              확인
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
