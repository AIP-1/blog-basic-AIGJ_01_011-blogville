import type { VisitStats } from "@/server/stats";

type Day = { date: string; count: number };

const n = (v: number) => v.toLocaleString("ko-KR");
/** `2026-10-05` → `10/5` */
const short = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/** 블로그 관리 맨 위 방문자 카드 (BLOG-06): 오늘·어제·전체와 최근 7일 막대 */
export function VisitChart({ stats, days }: { stats: VisitStats; days: Day[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft" data-visit-summary>
        오늘 {n(stats.today)} · 어제 {n(stats.yesterday)} · 전체 {n(stats.total)}
      </p>
      <ol className="grid grid-cols-7 items-end gap-1 sm:gap-2" aria-label="최근 7일 방문자">
        {days.map((d, i) => {
          const today = i === days.length - 1;
          const label = today ? "오늘" : short(d.date);
          return (
            <li key={d.date} className="flex min-w-0 flex-col items-center gap-1" aria-label={`${label} 방문 ${d.count}`} data-day={d.date}>
              <span className={`text-xs ${today ? "font-bold" : "text-ink-soft"}`} data-count>
                {n(d.count)}
              </span>
              <span className="flex h-28 w-full items-end justify-center" aria-hidden>
                <span
                  className={`w-full max-w-8 rounded-t ${today ? "bg-amber-400" : "bg-accent/60"}`}
                  style={{ height: `${Math.max(2, Math.round((d.count / max) * 100))}%` }}
                />
              </span>
              <span className={`text-xs ${today ? "font-bold" : "text-ink-soft"}`}>{label}</span>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-ink-soft">같은 사람은 하루 1번만 셉니다. 블로그 홈이나 글을 연 사람이 방문자이고, 내 방문은 세지 않아요.</p>
    </div>
  );
}
