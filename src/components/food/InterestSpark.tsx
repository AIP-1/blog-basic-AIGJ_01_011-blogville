import type { PlaceInterest } from "@/server/food";

const W = 320;
const H = 72;
const PAD = 6;

/** 🔎 식당 검색 관심 12주 꺾은선 (가장 많던 주가 100). 점에 마우스를 올리면 그 주 값이 보인다 */
export function InterestSpark({ interest }: { interest: PlaceInterest }) {
  const w = interest.weeks;
  const max = Math.max(1, ...w);
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, w.length - 1);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const line = w.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(w.length - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`;
  const trend = interest.rising ? "요즘 2주 검색이 늘었어요 ↑" : interest.falling ? "요즘 2주 검색이 줄었어요 ↓" : "검색이 꾸준해요";
  return (
    <section aria-labelledby="food-interest" className="rounded-xl border border-line bg-surface p-4" data-food-interest>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="food-interest" className="font-bold">
          🔎 네이버 검색 관심 <span className="text-xs font-normal text-ink-soft">최근 {w.length - 1}주</span>
        </h2>
        <span className={`text-xs ${interest.rising ? "font-bold text-accent" : "text-ink-soft"}`}>{trend}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-20 w-full text-accent" role="img" aria-label={`최근 ${w.length - 1}주 검색 관심: ${trend}`} preserveAspectRatio="none">
        <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} className="stroke-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d={area} fill="currentColor" opacity="0.12" />
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {w.map((v, i) => (
          <g key={i}>
            <rect x={x(i) - 12} y={0} width={24} height={H} fill="transparent">
              <title>{`${i === w.length - 1 ? "이번 주" : `${w.length - 1 - i}주 전`}: ${Math.round((v / max) * 100)}`}</title>
            </rect>
          </g>
        ))}
      </svg>
      <p className="mt-1 flex justify-between text-[11px] text-ink-soft">
        <span>{w.length - 1}주 전</span>
        <span>이번 주</span>
      </p>
    </section>
  );
}
