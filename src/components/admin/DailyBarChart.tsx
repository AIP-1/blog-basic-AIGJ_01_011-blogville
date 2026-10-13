import type { DailyStat } from "@/server/admin-tools";

type Metric = Exclude<keyof DailyStat, "day">;

/** `10/13` */
const short = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

/**
 * 날마다 수를 막대로 (ADM-03). 그림 라이브러리 없이 CSS 막대.
 * 화면 읽기 프로그램은 막대마다 `10월 13일 3` 글자를 읽는다 (막대 자체는 장식).
 */
export function DailyBarChart({ stats, metric, label, unit }: { stats: DailyStat[]; metric: Metric; label: string; unit: string }) {
  const values = stats.map((s) => s[metric]);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const dense = stats.length > 10;
  return (
    <figure className="rounded-xl border border-line p-3" data-chart={metric}>
      <figcaption className="mb-2 flex items-baseline justify-between gap-2">
        <span className="font-semibold">{label}</span>
        <span className="text-sm text-ink-soft">
          합계{" "}
          <strong className="text-ink" data-chart-total>
            {total.toLocaleString("ko-KR")}
          </strong>
          {unit}
        </span>
      </figcaption>
      <ol className="flex h-28 items-end gap-px" aria-label={`${label} 날짜별`}>
        {stats.map((s) => {
          const v = s[metric];
          return (
            <li key={s.day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${s.day}: ${v}${unit}`}>
              <span className="sr-only">
                {Number(s.day.slice(5, 7))}월 {Number(s.day.slice(8, 10))}일 {v}
                {unit}
              </span>
              {!dense && (
                <span aria-hidden="true" className="text-[10px] leading-tight text-ink-soft">
                  {v}
                </span>
              )}
              <span aria-hidden="true" className="w-full rounded-t bg-accent" style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 2 : 0 }} />
            </li>
          );
        })}
      </ol>
      <div aria-hidden="true" className="mt-1 flex justify-between text-[10px] text-ink-soft">
        <span>{short(stats[0].day)}</span>
        <span>{short(stats[stats.length - 1].day)}</span>
      </div>
    </figure>
  );
}
