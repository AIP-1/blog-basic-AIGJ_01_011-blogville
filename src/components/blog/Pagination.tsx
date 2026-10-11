import Link from "next/link";
import { pageNumbers } from "@/lib/ids";

type Props = { basePath: string; query: Record<string, string>; page: number; totalPages: number };

/** `?page=N` 페이지 번호. 다른 조건(카테고리)은 그대로 둔다. 많으면 가운데를 `…`로 줄인다 (POST-05). */
export function Pagination({ basePath, query, page, totalPages }: Props) {
  if (totalPages <= 1) return null;
  const href = (n: number) => {
    const params = new URLSearchParams(query);
    if (n > 1) params.set("page", String(n));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav aria-label="페이지" className="mt-6 flex flex-wrap justify-center gap-1">
      {pageNumbers(page, totalPages).map((n, i) =>
        n === "…" ? (
          <span key={`gap-${i}`} className="flex min-h-11 items-center px-1 text-ink-soft" aria-hidden="true">
            …
          </span>
        ) : (
          <Link key={n} href={href(n)} aria-current={n === page ? "page" : undefined} className={`btn ${n === page ? "btn-primary" : ""}`}>
            {n}
          </Link>
        ),
      )}
    </nav>
  );
}
