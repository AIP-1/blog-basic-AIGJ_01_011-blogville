import Link from "next/link";
import type { CategoryTree } from "@/server/category";

type Props = { slug: string; tree: CategoryTree; total: number; categoryId: number | null; subId: number | null };

export function CategoryNav({ slug, tree, total, categoryId, subId }: Props) {
  const item = (href: string, label: string, count: number, active: boolean, indent = false) => (
    <li key={href}>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-11 items-center justify-between rounded-lg px-3 ${indent ? "pl-7 text-sm" : ""} ${
          active ? "bg-accent/10 font-bold text-accent" : "hover:bg-bg"
        }`}
      >
        <span>{label}</span>
        <span className="text-sm text-ink-soft">({count})</span>
      </Link>
    </li>
  );
  const list = (
    <ul className="space-y-0.5">
      {item(`/@${slug}`, "전체", total, categoryId === null && subId === null)}
      {tree.flatMap((c) => [
        item(`/@${slug}?category=${c.id}`, c.name, c.postCount, categoryId === c.id && subId === null),
        ...c.subs.map((s) => item(`/@${slug}?category=${c.id}&sub=${s.id}`, s.name, s.postCount, subId === s.id, true)),
      ])}
    </ul>
  );
  return (
    <nav aria-label="카테고리">
      {/* 휴대폰은 접는 목록 */}
      <details className="rounded-xl border border-line bg-surface p-2 md:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center px-2 font-semibold">카테고리</summary>
        {list}
      </details>
      <div className="hidden rounded-xl border border-line bg-surface p-2 md:block">
        <h2 className="px-3 py-2 font-bold">카테고리</h2>
        {list}
      </div>
    </nav>
  );
}
