import Link from "next/link";
import { Time } from "@/components/common/Time";
import { shortName } from "@/lib/town/layout";
import { countedTasks, taskProgressText, type PlazaNews, type TodayTask } from "@/lib/town/plaza";
import { currentPrompt } from "@/lib/town/prompts";
import type { TownSpot } from "@/lib/town/structures";

// 광장 소식 서랍(PC)과 휴대폰 광장이 같이 쓰는 두 목록: 이웃 새 글, 오늘 할 일.
// 서버 화면(휴대폰 광장)에서도 그리므로 "use client" 없이 둔다. 텔레포트(`onTeleport`)는 PC 서랍만 넘긴다.

/** 불 켜진 창 하나: 24시간 안에 쓴 글 (광장의 불 켜진 집과 같은 뜻) */
function FreshMark() {
  return (
    <span className="inline-block size-2.5 shrink-0 bg-[#ffd36b] shadow-[0_0_0_2px_#3b2a20]" title="24시간 안에 쓴 글">
      <span className="sr-only">새 글, </span>
    </span>
  );
}

/**
 * 12px 도트 초롱 (plaza-upgrade-2: 서랍 칩·탭 '불 켜진 집'의 아이콘, 📰 대신). 광장 줄등의 청사초롱과 같은 홍청 두 단.
 * `lit`이면 속에 불이 켜진다. 글자 정보가 아니라 화면 낭독기에는 숨긴다.
 */
export function LanternIcon({ lit = true, className = "" }: { lit?: boolean; className?: string }) {
  // 6×6칸, 칸마다 2px
  const rows = ["..gg..", ".kRRk.", ".RLLR.", ".BLLB.", ".kBBk.", "..gg.."];
  const fill: Record<string, string> = { g: "#e9b341", k: "#3b2a20", R: "#c8342c", B: "#2f4a8f", L: lit ? "#ffd56e" : "#8c7f74" };
  return (
    <svg viewBox="0 0 6 6" width="12" height="12" shapeRendering="crispEdges" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
      {rows.flatMap((row, y) => [...row].map((c, x) => (fill[c] ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={fill[c]} /> : null)))}
    </svg>
  );
}

/**
 * 이웃 새 글: 제목은 사람이 쓴 글이라 고운바탕, 아래에 쓴 사람과 시각. 누르면 그 글로.
 * 이웃 글이 없으면(`village`) '마을 소식'으로 바꿔 마을 전체 새 글을 보이고 마을 소식·인기 글로 가는 길을 둔다.
 * 친구 마을(`host`)이면 그 회원이 즐겨찾는 이웃의 글이라 그렇게 적고, 내 이웃 새 글(/feed/following)로 가는 길은 두지 않는다.
 * 이 브라우저로 읽은 글(`read`, plaza-upgrade-2)은 흐리게 하고 ✓를 붙인다.
 * 시험 훅 `data-town-news`(neighbors|village), 글마다 `data-news-post`·`data-read`.
 */
export function NewsList({
  news,
  compact = false,
  limit,
  member = true,
  host = null,
}: {
  news: PlazaNews;
  compact?: boolean;
  limit?: number;
  member?: boolean;
  /** 친구 마을 구경이면 그 마을 주인 (TOWN-15) */
  host?: { nickname: string; slug: string } | null;
}) {
  const village = news.scope === "village";
  const posts = limit ? news.posts.slice(0, limit) : news.posts;
  const whose = host ? `${host.nickname}님이 즐겨찾는 이웃` : "즐겨찾는 이웃";
  return (
    <div className="space-y-2" data-town-news={news.scope}>
      {village && (
        <div className={compact ? "px-3 pt-1" : ""}>
          {/* 칸 제목(PC 서랍 탭·휴대폰 광장)이 이미 '마을 소식'이라 설명만 */}
          {!compact && <p className="font-bold">📋 마을 소식</p>}
          <p className="text-sm text-(--kit-ink-soft)">
            {member ? `⭐ ${whose}의 새 글이 없어서 마을 전체의 새 글을 보여 드려요.` : "마을 사람들이 쓴 새 글이에요. 가입하면 즐겨찾는 이웃의 새 글이 먼저 보여요."}
          </p>
        </div>
      )}
      {!village && host && <p className={`text-sm text-(--kit-ink-soft) ${compact ? "px-3 pt-1" : ""}`}>⭐ {whose}의 새 글이에요.</p>}
      {posts.length === 0 ? (
        <p className={`text-sm text-(--kit-ink-soft) ${compact ? "px-3" : ""}`}>아직 마을에 공개 글이 없어요. 첫 글을 써서 마을에 불을 켜 보세요.</p>
      ) : (
        <ol aria-label={village ? "마을 소식" : "이웃 새 글"}>
          {posts.map((post) => (
            <li key={post.id} className="border-b-2 border-(--kit-paper-2) last:border-b-0">
              <Link
                href={`/@${post.slug}/${post.id}`}
                className={`block px-3 py-2.5 hover:bg-(--kit-paper-2) ${post.read ? "text-(--kit-ink-soft)" : ""}`}
                data-news-post={post.id}
                data-read={post.read ? "1" : "0"}
              >
                <span className="line-clamp-2 font-(family-name:--blog-serif) text-[15px] leading-snug font-bold break-words">
                  {post.read && (
                    <span className="mr-1 font-sans" aria-hidden="true">
                      ✓
                    </span>
                  )}
                  {post.read && <span className="sr-only">읽은 글, </span>}
                  {post.title}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-xs text-(--kit-ink-soft)">
                  {post.fresh && !post.read && <FreshMark />}
                  <span className="min-w-0 flex-1 truncate font-semibold">{post.nickname}</span>
                  <Time date={post.createdAt} className="shrink-0" />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      <div className={`flex flex-wrap gap-1 ${compact ? "px-2 pb-2" : ""}`}>
        {village ? (
          <>
            <Link href="/feed" className="px-btn px-btn--quiet px-btn--sm">
              📋 마을 소식
            </Link>
            <Link href="/popular" className="px-btn px-btn--quiet px-btn--sm">
              🔥 인기 글
            </Link>
          </>
        ) : host ? (
          <Link href={`/@${host.slug}`} className="px-btn px-btn--quiet px-btn--sm">
            {/* 서랍 폭(280px)에 한 줄로: 닉네임은 8자에서 줄인다 */}
            🏠 {shortName(host.nickname, 8)}님 블로그 ›
          </Link>
        ) : (
          <Link href="/feed/following" className="px-btn px-btn--quiet px-btn--sm">
            이웃 새 글 모두 보기 ›
          </Link>
        )}
      </div>
    </div>
  );
}

/** 칸 몇 개 중 몇 개 (보상 3칸·하루 한 번 1칸). 많으면(돌보기 15번) 막대 */
function TaskMeter({ task }: { task: TodayTask }) {
  const { current, total } = task.progress;
  if (total > 3) {
    return (
      <span className="px-bar w-10 shrink-0 text-(--accent)" aria-hidden="true">
        <span style={{ width: `${Math.round((current / total) * 100)}%` }} />
      </span>
    );
  }
  return (
    <span className="px-cells text-(--accent)" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} data-on={i < current ? "" : undefined} />
      ))}
    </span>
  );
}

/**
 * 오늘 할 일: 이미 있는 하루 루프(글쓰기 보상·낚시·동물 돌보기·이웃 글 댓글)와 진행, 줄마다 그 일의 기존 보상(새 보상 없음). 한 일에는 ✓.
 * 출석은 화면을 열면 저절로라 줄에서 빼고 머리 도장('📮 출석 완료 · 🔥 연속 12일', 출석 화면 링크)으로 보인다 (plaza-upgrade-2).
 * ✏️ 공개 글 줄 아래에는 이번 주 글감(`currentPrompt`, /prompt)을 보조 줄로.
 * PC 서랍은 그 장소 앞으로 [✨ 가기](텔레포트, 누른 뒤 초점을 놓아 다음 Space가 그 건물로 들어가게), 장소가 없으면(글쓰기·댓글) 링크.
 * 휴대폰 광장은 모두 링크. 시험 훅 `data-task`(id)·`data-done`·`data-attendance`.
 */
export function TaskList({
  tasks,
  places = [],
  onTeleport,
}: {
  tasks: readonly TodayTask[];
  /** 텔레포트 목록의 장소 (`townSpots().places`) */
  places?: readonly TownSpot[];
  onTeleport?: (spot: TownSpot) => void;
}) {
  const attendance = tasks.find((t) => t.id === "attendance");
  const prompt = currentPrompt(new Date());
  return (
    // grid-cols-1(minmax(0, 1fr)): 줄 안 긴 글감 제목이 칸 폭을 서랍보다 넓히지 않게 (D1)
    <div className="grid grid-cols-1 gap-1">
      {attendance && (
        <Link
          href={attendance.href}
          className="mx-3 my-1 flex min-h-11 items-center gap-2 bg-(--kit-sun-paper) px-3 py-1.5 text-sm font-bold hover:bg-(--kit-sun-paper-hover)"
          data-attendance={attendance.done ? "1" : "0"}
        >
          <span aria-hidden="true">📮</span>
          <span className="min-w-0 flex-1">
            {attendance.done ? "출석 완료" : "출석 도장 받기"}
            {(attendance.streak ?? 0) > 0 && ` · 🔥 연속 ${attendance.streak}일`}
          </span>
          <span aria-hidden="true">›</span>
        </Link>
      )}
      <ul className="grid grid-cols-1 gap-1" aria-label="오늘 할 일">
        {countedTasks(tasks).map((task) => {
          const spot = onTeleport && task.spot ? places.find((p) => p.id === task.spot) : undefined;
          return (
            <li key={task.id} className="flex min-h-12 items-center gap-2.5 px-3 py-1.5" data-task={task.id} data-done={task.done ? "1" : "0"}>
              <span
                className={`grid size-5 shrink-0 place-items-center text-xs font-bold ${
                  task.done ? "bg-(--accent) text-(--kit-on-accent)" : "shadow-[inset_0_0_0_2px_var(--kit-ink-soft)]"
                }`}
                aria-hidden="true"
              >
                {task.done ? "✓" : ""}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${task.done ? "text-(--kit-ink-soft)" : ""}`}>
                  {task.done && <span className="sr-only">한 일, </span>}
                  <span aria-hidden="true">{task.icon} </span>
                  {task.label}
                </span>
                {/* 280px 서랍에서도 넘치지 않게 보상은 자리가 모자라면 다음 줄로 (D1) */}
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-(--kit-ink-soft)">
                  <TaskMeter task={task} />
                  <span className="min-w-0">{taskProgressText(task)}</span>
                  {task.reward && (
                    <span className="shrink-0 font-bold" data-task-reward>
                      <span className="sr-only">보상 </span>
                      {task.reward}
                    </span>
                  )}
                </span>
                {task.id === "post" && (
                  // 손가락으로 누르는 화면에서는 44px 높이 (PC 서랍 줄은 그대로 얇게)
                  <Link
                    href="/prompt"
                    className="mt-1 flex items-center text-xs font-semibold underline underline-offset-2 hover:text-(--kit-ink) pointer-coarse:min-h-11"
                    data-task-prompt
                  >
                    <span className="min-w-0 truncate">📝 이번 주 글감: {prompt.title}</span>
                  </Link>
                )}
              </span>
              {spot ? (
                <button
                  type="button"
                  className="px-btn px-btn--quiet px-btn--sm shrink-0"
                  // 이름은 보이는 글자로 시작한다 (말로 누르기, WCAG 2.5.3)
                  aria-label={`가기: ${task.label}, ${spot.label} 앞으로 텔레포트`}
                  onClick={(event) => {
                    onTeleport!(spot);
                    event.currentTarget.blur();
                  }}
                >
                  ✨ 가기
                </button>
              ) : (
                <Link href={task.href} className="px-btn px-btn--quiet px-btn--sm shrink-0" aria-label={`${task.id === "post" ? "쓰기" : "가기"}: ${task.label}`}>
                  {task.id === "post" ? "✏️ 쓰기" : "가기"}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
