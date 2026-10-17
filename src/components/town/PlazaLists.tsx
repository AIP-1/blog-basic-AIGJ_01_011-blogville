import Link from "next/link";
import { Time } from "@/components/common/Time";
import { taskProgressText, type PlazaNews, type TodayTask } from "@/lib/town/plaza";
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
 * 이웃 새 글: 제목은 사람이 쓴 글이라 고운바탕, 아래에 쓴 사람과 시각. 누르면 그 글로.
 * 이웃 글이 없으면(`village`) '마을 소식'으로 바꿔 마을 전체 새 글을 보이고 마을 소식·인기 글로 가는 길을 둔다.
 * 시험 훅 `data-town-news`(neighbors|village), 글마다 `data-news-post`.
 */
export function NewsList({ news, compact = false, limit, member = true }: { news: PlazaNews; compact?: boolean; limit?: number; member?: boolean }) {
  const village = news.scope === "village";
  const posts = limit ? news.posts.slice(0, limit) : news.posts;
  return (
    <div className="space-y-2" data-town-news={news.scope}>
      {village && (
        <div className={compact ? "px-3 pt-1" : ""}>
          {/* 휴대폰 광장은 칸 제목이 이미 '마을 소식'이라 설명만 */}
          {!compact && <p className="font-bold">📋 마을 소식</p>}
          <p className="text-sm text-(--kit-ink-soft)">
            {member ? "⭐ 즐겨찾는 이웃의 새 글이 없어서 마을 전체의 새 글을 보여 드려요." : "마을 사람들이 쓴 새 글이에요. 가입하면 즐겨찾는 이웃의 새 글이 먼저 보여요."}
          </p>
        </div>
      )}
      {posts.length === 0 ? (
        <p className={`text-sm text-(--kit-ink-soft) ${compact ? "px-3" : ""}`}>아직 마을에 공개 글이 없어요. 첫 글을 써서 마을에 불을 켜 보세요.</p>
      ) : (
        <ol aria-label={village ? "마을 소식" : "이웃 새 글"}>
          {posts.map((post) => (
            <li key={post.id} className="border-b-2 border-(--kit-paper-2) last:border-b-0">
              <Link href={`/@${post.slug}/${post.id}`} className="block px-3 py-2.5 hover:bg-(--kit-paper-2)" data-news-post={post.id}>
                <span className="line-clamp-2 font-(family-name:--blog-serif) text-[15px] leading-snug font-bold break-words">{post.title}</span>
                <span className="mt-1 flex items-center gap-1.5 text-xs text-(--kit-ink-soft)">
                  {post.fresh && <FreshMark />}
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
      <span className="px-bar w-14 text-(--accent)" aria-hidden="true">
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
 * 오늘 할 일: 이미 있는 하루 루프(출석·글쓰기 보상·낚시·동물 돌보기)와 진행. 한 일에는 ✓.
 * PC 서랍은 그 장소 앞으로 [✨ 가기](텔레포트, 누른 뒤 초점을 놓아 다음 Space가 그 건물로 들어가게), 장소가 없으면(글쓰기) 링크.
 * 휴대폰 광장은 모두 링크. 시험 훅 `data-task`(id)·`data-done`.
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
  return (
    <ul className="grid gap-1" aria-label="오늘 할 일">
      {tasks.map((task) => {
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
              <span className="mt-0.5 flex items-center gap-2 text-xs text-(--kit-ink-soft)">
                <TaskMeter task={task} />
                {taskProgressText(task)}
              </span>
            </span>
            {spot ? (
              <button
                type="button"
                className="px-btn px-btn--quiet px-btn--sm shrink-0"
                aria-label={`${task.label}: ${spot.label} 앞으로 텔레포트`}
                onClick={(event) => {
                  onTeleport!(spot);
                  event.currentTarget.blur();
                }}
              >
                ✨ 가기
              </button>
            ) : (
              <Link href={task.href} className="px-btn px-btn--quiet px-btn--sm shrink-0" aria-label={`${task.label}: ${task.id === "post" ? "글쓰기" : "가기"}`}>
                {task.id === "post" ? "✏️ 쓰기" : "가기"}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
