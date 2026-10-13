"use client";

import "./globals.css";

/**
 * 루트 레이아웃(헤더)까지 실패했을 때의 오류 화면 (NF-19). 레이아웃을 대신하므로 html·body를 직접 그린다.
 * [처음으로]는 링크 이동이 아니라 새로 불러오기: 레이아웃부터 다시 받는다.
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ko">
      <body className="flex min-h-dvh flex-col">
        <title>잠깐 문제가 생겼어요 | Blogville</title>
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 text-center">
          <p className="text-5xl" aria-hidden>
            🚧
          </p>
          <h1 className="mt-4 text-2xl font-bold">잠깐 문제가 생겼어요</h1>
          <div className="mt-6 flex justify-center gap-2">
            <button type="button" className="btn btn-primary" onClick={() => retry()}>
              다시 시도
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- 레이아웃이 실패한 뒤라 새로 불러온다 */}
            <a href="/" className="btn">
              처음으로
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
