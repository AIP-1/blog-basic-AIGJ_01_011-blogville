import Link from "next/link";

type Props = {
  categoryName: string | null;
  subcategoryName: string | null;
  /** 있으면 그 카테고리 글 목록으로 가는 링크 (글 상세) */
  href?: string;
};

export function CategoryBadge({ categoryName, subcategoryName, href }: Props) {
  if (!categoryName) return null;
  const label = subcategoryName ? `${categoryName} › ${subcategoryName}` : categoryName;
  const className = "inline-block rounded-full bg-accent/10 px-2.5 py-0.5 text-sm font-semibold text-accent";
  return href ? (
    <Link href={href} className={`${className} inline-flex min-h-11 items-center`}>
      {label}
    </Link>
  ) : (
    <span className={className}>{label}</span>
  );
}
