import Link from "next/link";

type Props = { basePath: string; query: Record<string, string>; page: number; totalPages: number };

/** `?page=N` 페이지 번호. 다른 조건(카테고리)은 그대로 둔다. */
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
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
        <Link
          key={n}
          href={href(n)}
          aria-current={n === page ? "page" : undefined}
          className={`btn ${n === page ? "btn-primary" : ""}`}
        >
          {n}
        </Link>
      ))}
    </nav>
  );
}
