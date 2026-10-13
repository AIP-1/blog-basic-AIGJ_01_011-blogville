"use client";

import { useEffect, useRef } from "react";
import type { TocItem } from "@/lib/reader";

/**
 * 📑 목차 (글 읽기 편의): 소제목(h2·h3)이 3개 이상인 글의 본문 위.
 * 처음엔 펼쳐 두고, 휴대폰처럼 좁은 화면에서는 본문이 바로 보이게 접는다.
 */
export function TableOfContents({ items }: { items: TocItem[] }) {
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (details.current && window.matchMedia("(max-width: 639px)").matches) details.current.open = false;
  }, []);
  return (
    <details ref={details} open className="toc mt-6 rounded-xl border border-line bg-bg px-4 py-2" data-toc>
      <summary className="flex min-h-11 cursor-pointer items-center font-bold">📑 목차</summary>
      <nav aria-label="목차" className="pb-2">
        <ol className="space-y-0.5">
          {items.map((item) => (
            <li key={item.id} className={item.level === 3 ? "pl-4 text-sm" : ""}>
              <a href={`#${item.id}`} className="flex min-h-11 items-center text-ink-soft hover:text-accent hover:underline">
                {item.text}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
}
