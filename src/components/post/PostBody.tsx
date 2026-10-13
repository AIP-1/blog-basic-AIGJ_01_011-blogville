"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

type Zoom = { src: string; alt: string };

/** 크게 볼 수 있는 본문 사진 (링크 안의 사진은 링크가 먼저) */
function zoomable(el: Element | null): el is HTMLImageElement {
  return el instanceof HTMLImageElement && el.closest("a") === null;
}

/**
 * 글 본문 (글 읽기 편의). html은 서버가 정화·색칠한 것(post-render.ts)이다.
 * - 코드 블록의 [복사]: 코드 글자를 복사하고 잠깐 "복사했어요"
 * - 사진을 누르거나 Enter·Space: 크게 보기(<dialog>). Esc·[닫기]·바깥을 누르면 닫힌다.
 */
export function PostBody({ html }: { html: string }) {
  const body = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState<Zoom | null>(null);

  // 사진을 키보드로도 누를 수 있게 (본문 HTML은 React가 그리지 않으므로 속성을 직접 단다)
  useEffect(() => {
    for (const img of body.current?.querySelectorAll("img") ?? []) {
      if (!zoomable(img)) continue;
      img.tabIndex = 0;
      img.setAttribute("role", "button");
      img.setAttribute("aria-label", img.alt ? `사진 크게 보기: ${img.alt}` : "사진 크게 보기");
      img.dataset.zoom = "";
    }
  }, [html]);

  const open = (img: HTMLImageElement) => {
    setZoom({ src: img.getAttribute("src") ?? img.src, alt: img.alt });
    if (!dialog.current?.open) dialog.current?.showModal();
  };

  const copy = async (button: HTMLButtonElement) => {
    const code = button.parentElement?.querySelector("pre")?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(code);
      button.textContent = "복사했어요";
    } catch {
      button.textContent = "복사하지 못했어요";
    }
    window.setTimeout(() => (button.textContent = "복사"), 2000);
  };

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    const button = target.closest("button[data-copy-code]");
    if (button instanceof HTMLButtonElement) return void copy(button);
    if (zoomable(target)) open(target);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === "Enter" || e.key === " ") && zoomable(e.target as Element)) {
      e.preventDefault();
      open(e.target as HTMLImageElement);
    }
  };

  return (
    <>
      {/* 클릭은 본문 안의 버튼·사진(role=button, tabIndex)에서 오고 키보드는 onKeyDown이 받는다 */}
      <div ref={body} className="prose-post mt-6" onClick={onClick} onKeyDown={onKeyDown} dangerouslySetInnerHTML={{ __html: html }} />
      <dialog
        ref={dialog}
        aria-label="사진 크게 보기"
        className="lightbox m-auto max-h-[100dvh] max-w-[100vw] bg-transparent p-0 backdrop:bg-black/80"
        onClose={() => setZoom(null)}
        onClick={(e) => {
          // 사진·버튼 바깥(배경)을 누르면 닫는다
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        data-lightbox
      >
        {zoom && (
          <figure className="flex flex-col items-center gap-2 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- 본문에 있던 우리 저장소(/files) 사진 */}
            <img src={zoom.src} alt={zoom.alt} className="max-h-[80dvh] max-w-[calc(100vw-2rem)] rounded-lg object-contain" />
            {zoom.alt && <figcaption className="max-w-prose text-center text-white">{zoom.alt}</figcaption>}
            <form method="dialog">
              <button type="submit" className="btn" autoFocus>
                닫기
              </button>
            </form>
          </figure>
        )}
      </dialog>
    </>
  );
}
