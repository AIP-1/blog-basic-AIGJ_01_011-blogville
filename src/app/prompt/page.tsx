import type { Metadata } from "next";
import Link from "next/link";
import { GamePageShell } from "@/components/game/GamePageShell";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { boardArt } from "@/lib/art/town";
import { relativeTime } from "@/lib/time";
import { currentPrompt, parseWeekKey, promptForWeek, weekKey, weekLabel, weekRange } from "@/lib/town/prompts";
import { getSession } from "@/server/dal";
import { getPromptAnswers } from "@/server/prompts";

export const metadata: Metadata = { title: "이번 주 글감 | Blogville" };

/** 게임 화면 간판 (GAME_ROOMS 표 밖의 화면). 광장 게시판 앞으로 돌아간다 */
const ROOM = { key: "prompt", emoji: "📝", title: "이번 주 글감", spot: "prompt", width: "narrow" } as const;

/** 지난 글감은 이만큼 앞 주까지 넘겨 본다 */
const PAST_WEEKS = 8;

/**
 * 이번 주 글감 (plaza-upgrade-2 C1): 광장 게시판의 세 번째 입구 '📝 글감'. 한국 시각 ISO 주마다 바뀌는 주제와 한 줄 안내,
 * [✏️ 이 글감으로 쓰기](/write?topic={주 키}), 그 아래 '이웃의 답장'(그 주에 글감 태그로 쓴 공개 글).
 * `?week=2026-W41`로 지난 글감을 본다(앞으로 올 주는 이번 주로). 시험 훅 `data-prompt`(주 키)·`data-prompt-answer`.
 */
export default async function PromptPage({ searchParams }: PageProps<"/prompt">) {
  const { week } = await searchParams;
  const member = await getSession();
  const now = new Date();
  const thisWeek = weekKey(now);
  const asked = parseWeekKey(week);
  const key = asked && weekRange(asked).start <= now && weekRange(asked).start >= shiftWeek(thisWeek, -PAST_WEEKS) ? asked : thisWeek;
  const prompt = key === thisWeek ? currentPrompt(now) : promptForWeek(key);
  const current = key === thisWeek;
  const answers = await getPromptAnswers(prompt);
  const prev = weekKey(new Date(weekRange(key).start.getTime() - 86_400_000));
  const showPrev = weekRange(prev).start >= shiftWeek(thisWeek, -PAST_WEEKS);
  const next = weekKey(weekRange(key).end);

  return (
    <GamePageShell room={ROOM} art={boardArt(3, 0)} description="한 주에 한 가지 주제로 마을 이웃이 함께 글을 써요. 같은 글감으로 쓴 글은 아래에 모여요.">
      <div className="space-y-6" data-prompt={prompt.key}>
        <nav aria-label="글감 주" className="flex items-center justify-between gap-2 text-sm">
          {showPrev ? (
            <Link href={`/prompt?week=${prev}`} className="px-btn px-btn--sm px-btn--quiet">
              ‹ 지난주
            </Link>
          ) : (
            <span />
          )}
          <span className="font-semibold text-ink-soft">
            {current ? "이번 주" : "지난 글감"} · {weekLabel(key)}
          </span>
          {current ? (
            <span />
          ) : (
            <Link href={next === thisWeek ? "/prompt" : `/prompt?week=${next}`} className="px-btn px-btn--sm px-btn--quiet">
              다음 주 ›
            </Link>
          )}
        </nav>

        {/* 게시판에 압정으로 꽂은 쪽지 한 장 */}
        <section aria-labelledby="prompt-title" className="px-tile relative px-5 pt-7 pb-5 text-center" data-tone="sun">
          <span aria-hidden="true" className="absolute top-2 left-1/2 size-3 -translate-x-1/2 bg-[#c8542c] shadow-[0_0_0_2px_#3b2a20]" />
          <p className="text-sm font-semibold text-ink-soft">📝 {current ? "이번 주 글감" : "그 주의 글감"}</p>
          <h2 id="prompt-title" className="mt-2 text-2xl leading-snug font-extrabold break-keep">
            {prompt.title}
          </h2>
          <p className="mt-2 break-keep">{prompt.hint}</p>
          <p className="mt-3 text-sm text-ink-soft">
            글에 <span className="px-chip">#글감</span> <span className="px-chip">#{prompt.tag}</span> 태그가 붙어요
          </p>
          {current && (
            <Link href={`/write?topic=${prompt.key}`} className="px-btn px-btn--primary mt-4" data-prompt-write>
              ✏️ 이 글감으로 쓰기
            </Link>
          )}
          {current && !member && <p className="mt-2 text-sm text-ink-soft">글은 로그인하면 쓸 수 있어요.</p>}
        </section>

        <section aria-labelledby="prompt-answers">
          <h2 id="prompt-answers" className="font-bold">
            💌 이웃의 답장 <span className="text-sm font-normal text-ink-soft">({answers.length})</span>
          </h2>
          {answers.length === 0 ? (
            <p className="mt-2 text-ink-soft">{current ? "아직 답장이 없어요. 첫 글을 남겨 보세요." : "그 주에는 답장이 없었어요."}</p>
          ) : (
            <ul className="px-tile mt-3 divide-y-2 divide-line">
              {answers.map((a) => (
                <li key={a.id} data-prompt-answer={a.id}>
                  <Link href={`/@${a.slug}/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-(--kit-paper-hover)">
                    <ProfileAvatar photoKey={a.photoKey} nickname={a.nickname} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 font-(family-name:--blog-serif) text-[15px] leading-snug font-bold break-words">{a.title}</span>
                      <span className="mt-0.5 block text-sm text-ink-soft">
                        {a.nickname} · {relativeTime(a.createdAt, now)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </GamePageShell>
  );
}

/** 주 키에서 `by`주 앞뒤 주의 시작 시각 */
function shiftWeek(key: string, by: number): Date {
  return new Date(weekRange(key).start.getTime() + by * 7 * 86_400_000);
}
