"use client";

import { useRef, useState, useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * 공유 막대 (글 읽기 편의): [🔗 링크 복사] · [공유하기](휴대폰 등 공유 창이 있는 브라우저) · X · 페이스북.
 * 비공개 글에는 두지 않는다 (글 화면이 정한다).
 */
export function ShareBar({ url, title }: { url: string; title: string }) {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  // 공유 창(navigator.share)은 브라우저에서만 알 수 있다. 서버 렌더에서는 숨긴다.
  const canShare = useSyncExternalStore(
    noop,
    () => typeof navigator.share === "function",
    () => false,
  );

  const say = (message: string) => {
    setToast(message);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 2500);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      say("링크를 복사했어요");
    } catch {
      say("복사하지 못했어요. 주소창의 주소를 복사해 주세요");
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title, url });
    } catch {
      // 사용자가 공유 창을 닫은 경우 등: 아무것도 하지 않는다
    }
  };

  const enc = encodeURIComponent;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-2" aria-label="이 글 공유하기" role="group" data-share-bar>
      <button type="button" className="btn" onClick={copy}>
        🔗 링크 복사
      </button>
      {canShare && (
        <button type="button" className="btn" onClick={share}>
          공유하기
        </button>
      )}
      <a className="btn" href={`https://x.com/intent/post?text=${enc(title)}&url=${enc(url)}`} target="_blank" rel="noopener noreferrer">
        X에 공유
      </a>
      <a className="btn" href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`} target="_blank" rel="noopener noreferrer">
        페이스북에 공유
      </a>
      <p role="status" className={toast ? "toast" : "sr-only"}>
        {toast}
      </p>
    </div>
  );
}
