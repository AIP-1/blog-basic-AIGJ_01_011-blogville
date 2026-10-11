"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="mx-auto max-w-md py-16 text-center">
      <p className="text-5xl" aria-hidden>
        🚧
      </p>
      <h1 className="mt-4 text-2xl font-bold">잠깐 문제가 생겼어요</h1>
      <div className="mt-6 flex justify-center gap-2">
        <button type="button" className="btn btn-primary" onClick={reset}>
          다시 시도
        </button>
        <Link href="/" className="btn">
          처음으로
        </Link>
      </div>
    </section>
  );
}
