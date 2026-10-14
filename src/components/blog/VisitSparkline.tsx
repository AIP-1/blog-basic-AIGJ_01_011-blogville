/** 👣 방문자 위젯(크게): 최근 7일 막대. 마지막 막대가 오늘 */
export function VisitSparkline({ days }: { days: { date: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const label = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
  return (
    <figure className="mt-3" data-visit-days>
      <ol className="flex h-16 items-end gap-1.5" aria-label="최근 7일 방문자">
        {days.map((d, i) => (
          <li key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1" aria-label={`${label(d.date)} ${d.count}명`}>
            <span className="text-[10px] tabular-nums text-ink-soft">{d.count}</span>
            <span
              className={`w-full rounded-t-sm ${i === days.length - 1 ? "bg-accent" : "bg-accent/35"}`}
              style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
            />
          </li>
        ))}
      </ol>
      <figcaption className="mt-1 flex justify-between text-[10px] text-ink-soft">
        <span>{label(days[0]?.date ?? "")}</span>
        <span>오늘</span>
      </figcaption>
    </figure>
  );
}
