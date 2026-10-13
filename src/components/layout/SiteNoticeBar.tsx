"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * 사이트 공지 띠 (ADM-04, specs/058-admin-tools): 모든 화면 맨 위 한 줄. PC 마을 화면에서는 CSS가 숨긴다 (.site-notice).
 * [닫기]는 이 브라우저에 기억한다 (`dismissKey`에 공지를 저장한 시각이 들어 있어, 공지를 다시 저장하면 또 보인다).
 * 닫았는지는 브라우저에서만 알 수 있어, 화면이 준비된 뒤에 보인다 (닫은 공지가 깜빡이지 않게).
 */
export function SiteNoticeBar({ text, link, dismissKey }: { text: string; link: string | null; dismissKey: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(dismissKey) === "1";
    } catch {
      // 저장소를 못 쓰는 브라우저: 닫기를 기억하지 못할 뿐 공지는 보인다
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저 저장소는 화면이 준비된 뒤에만 읽을 수 있다
    setOpen(!dismissed);
  }, [dismissKey]);
  if (!open) return null;
  const close = () => {
    try {
      window.localStorage.setItem(dismissKey, "1");
    } catch {
      // 기억하지 못해도 이번에는 닫는다
    }
    setOpen(false);
  };
  return (
    <aside aria-label="사이트 공지" className="site-notice notice-yellow border-x-0 border-t-0" data-site-notice>
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-1 text-sm">
        <p className="min-w-0 flex-1 break-words">
          📢{" "}
          {link ? (
            <Link href={link} className="font-semibold underline">
              {text}
            </Link>
          ) : (
            <span className="font-semibold">{text}</span>
          )}
        </p>
        <button type="button" onClick={close} className="btn btn-ghost shrink-0 px-2" aria-label="공지 닫기">
          ✕
        </button>
      </div>
    </aside>
  );
}
