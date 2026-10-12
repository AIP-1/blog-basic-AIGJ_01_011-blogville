import type { Metadata } from "next";
import { formatNumber } from "@/lib/game";
import { monthCalendar } from "@/lib/kst";
import { ensureTodayAttendance, listAttendanceRewards, listMonthAttendances } from "@/server/attendance";
import { requireMember } from "@/server/dal";

export const metadata: Metadata = { title: "출석 체크 | Blogville" };

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

// 출석 체크 (GAME-04): 버튼 없이 오늘 결과, 7일 보상표, 이번 달 달력
export default async function AttendancePage() {
  const member = await requireMember();
  // 헤더가 이미 기록했으면 읽기만 한다. 헤더에서 실패했으면 한 번 더 해 보고, 또 실패하면 오류 화면
  const today = await ensureTodayAttendance(member.userId, member.sessionId);
  if (!today) throw new Error("출석을 기록하지 못함");
  const calendar = monthCalendar(today.date);
  const [rewards, attended] = await Promise.all([listAttendanceRewards(), listMonthAttendances(member.userId, calendar.start, calendar.end)]);
  const attendedSet = new Set(attended);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-extrabold">📮 출석 체크</h1>

      <section className="rounded-2xl border border-line bg-surface p-6 text-center" aria-label="오늘 출석">
        <p className="text-5xl" aria-hidden="true">
          🎁
        </p>
        <p className="mt-2 text-xl font-extrabold" role="status">
          출석 완료! 오늘 {today.cycleDay}일차
        </p>
        <p className="mt-1 text-ink-soft">
          오늘 받은 보상 ✨ {today.exp} · 🪙 {formatNumber(today.coins)}
        </p>
      </section>

      <section aria-labelledby="rewards-title">
        <h2 id="rewards-title" className="mb-2 font-bold">
          7일 출석 보상
        </h2>
        <ol className="grid grid-cols-7 gap-1 text-center text-xs sm:text-sm" aria-label="보상표">
          {rewards.map((r) => {
            const on = r.day === today.cycleDay;
            return (
              <li
                key={r.day}
                aria-current={on ? "step" : undefined}
                className={`min-w-0 rounded-lg border-2 px-0.5 py-2 ${on ? "border-amber-400 bg-amber-50 font-bold" : "border-line bg-surface"}`}
              >
                <span className="block">{r.day}일차</span>
                <span className="block text-sky-600">✨{r.exp}</span>
                <span className="block">🪙{r.coins}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-sm text-ink-soft">하루라도 빠지거나 7일차를 받은 다음 날은 1일차부터 다시 시작해요.</p>
      </section>

      <section aria-labelledby="calendar-title" className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="calendar-title" className="font-bold">
            {calendar.year}년 {calendar.month}월
          </h2>
          <p className="text-sm text-ink-soft" data-month-summary>
            이번 달 {attended.length}일 출석 · 현재 {today.cycleDay}일차
          </p>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm font-semibold text-ink-soft" aria-hidden="true">
          {WEEK.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <ol className="mt-1 grid grid-cols-7 gap-1 text-center text-sm" aria-label="이번 달 출석">
          {calendar.cells.map((d, i) => {
            if (!d) return <li key={`blank-${i}`} aria-hidden="true" />;
            const done = attendedSet.has(d);
            const isToday = d === today.date;
            const dayNum = Number(d.slice(8));
            return (
              <li
                key={d}
                aria-label={`${calendar.month}월 ${dayNum}일${done ? " 출석" : ""}`}
                aria-current={isToday ? "date" : undefined}
                data-day={d}
                data-attended={done ? "yes" : "no"}
                className={`flex aspect-square items-center justify-center rounded-md ${done ? "bg-green-100" : ""} ${isToday ? "border-2 border-amber-400" : ""}`}
              >
                {done ? "🌟" : dayNum}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
