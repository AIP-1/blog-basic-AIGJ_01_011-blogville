"use client";

import Link from "next/link";

/**
 * 화면 일부의 오류 (NF-19). [다시 시도]는 retry: 서버에서 화면을 다시 받아 그린다.
 * reset은 받아 둔 화면을 다시 그릴 뿐이라 DB가 잠깐 끊긴 뒤에도 같은 오류가 남는다.
 */
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section className="mx-auto max-w-md py-16 text-center">
      <title>잠깐 문제가 생겼어요 | Blogville</title>
      <p className="text-5xl" aria-hidden>
        🚧
      </p>
      <h1 className="mt-4 text-2xl font-bold">잠깐 문제가 생겼어요</h1>
      <div className="mt-6 flex justify-center gap-2">
        <button type="button" className="btn btn-primary" onClick={() => retry()}>
          다시 시도
        </button>
        <Link href="/" className="btn">
          처음으로
        </Link>
      </div>
    </section>
  );
}
