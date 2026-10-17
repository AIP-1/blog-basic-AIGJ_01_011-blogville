import type { Metadata } from "next";
import { GamePageShell } from "@/components/game/GamePageShell";
import { boardArt } from "@/lib/art/town";
import { formatNumber } from "@/lib/game";
import { monthCalendar } from "@/lib/kst";
import { ensureTodayAttendanceOnce, listAttendanceRewards, listMonthAttendances } from "@/server/attendance";
import { requireMember } from "@/server/dal";

export const metadata: Metadata = { title: "출석 체크 | Blogville" };

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

// 출석 체크 (GAME-04): 버튼 없이 오늘 결과, 7일 보상표, 이번 달 달력. 간판은 광장의 마을 게시판(출석 도장 칸).
// 도장은 광장 게시판처럼 이번 주기의 오늘 일차만큼 찍는다. 소식 종이 수는 집 정보를 읽지 않는 화면이라 기본값(3장)
export default async function AttendancePage() {
  const member = await requireMember();
  // 헤더가 이미 기록했으면 읽기만 한다. 헤더에서 실패했으면 한 번 더 해 보고, 또 실패하면 오류 화면
  const today = await ensureTodayAttendanceOnce(member.userId, member.sessionId);
  if (!today) throw new Error("출석을 기록하지 못함");
  const calendar = monthCalendar(today.date);
  const [rewards, attended] = await Promise.all([listAttendanceRewards(), listMonthAttendances(member.userId, calendar.start, calendar.end)]);
  const attendedSet = new Set(attended);

  return (
    <GamePageShell room="attendance" art={boardArt(3, today.cycleDay)} description="하루에 한 번 Blogville에 들어오기만 하면 저절로 출석돼요. 7일을 이어 오면 보상이 커져요.">
      <div className="space-y-6">
        <section className="px-tile p-6 text-center" data-tone="sun" aria-label="오늘 출석">
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
          <h2 id="rewards-title" className="mb-3 font-bold">
            7일 출석 보상
          </h2>
          <ol className="grid grid-cols-7 gap-1.5 text-center text-xs sm:gap-2.5 sm:text-sm" aria-label="보상표">
            {rewards.map((r) => {
              const on = r.day === today.cycleDay;
              return (
                <li key={r.day} aria-current={on ? "step" : undefined} className={`px-tile min-w-0 px-0.5 py-2 ${on ? "font-bold" : ""}`} {...(on ? { "data-on": "", "data-tone": "sun" } : {})}>
                  <span className="block">{r.day}일차</span>
                  <span className="px-exp block">✨{r.exp}</span>
                  <span className="block">🪙{r.coins}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-sm text-ink-soft">하루라도 빠지거나 7일차를 받은 다음 날은 1일차부터 다시 시작해요.</p>
        </section>

        <section aria-labelledby="calendar-title" className="px-tile p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="calendar-title" className="font-bold">
              {calendar.year}년 {calendar.month}월
            </h2>
            <p className="text-sm text-ink-soft" data-month-summary>
              이번 달 {attended.length}일 출석 · 현재 {today.cycleDay}일차
            </p>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm font-semibold text-ink-soft sm:gap-1.5" aria-hidden="true">
            {WEEK.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
          {/* 날짜 숫자는 칸 왼쪽 위에 그린다(::before, data-num). 칸 글자는 출석한 날의 🌟 도장뿐 */}
          <ol className="mt-1 grid grid-cols-7 gap-1 text-center text-lg leading-none sm:gap-1.5 sm:text-2xl" aria-label="이번 달 출석">
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
                  data-num={dayNum}
                  data-attended={done ? "yes" : "no"}
                  className="px-cal-day flex h-12 items-end justify-center pb-1 sm:h-16"
                >
                  {done ? "🌟" : ""}
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </GamePageShell>
  );
}
