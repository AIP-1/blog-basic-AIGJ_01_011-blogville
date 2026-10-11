import Link from "next/link";

export const metadata = { title: "길을 잃었어요 | Blogville" };

export default function NotFound() {
  return (
    <section className="mx-auto max-w-md py-16 text-center">
      <p className="text-5xl" aria-hidden>
        🧭
      </p>
      <h1 className="mt-4 text-2xl font-bold">길을 잃었어요</h1>
      <p className="mt-2 text-ink-soft">찾는 블로그나 글이 없거나, 비공개 글이에요.</p>
      <Link href="/" className="btn btn-primary mt-6">
        처음으로
      </Link>
    </section>
  );
}
