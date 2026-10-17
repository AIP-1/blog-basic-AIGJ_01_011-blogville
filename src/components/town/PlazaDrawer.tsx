"use client";

import Link from "next/link";
import { useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import type { PlazaNews, TodayTask } from "@/lib/town/plaza";
import type { TownSpot } from "@/lib/town/structures";
import { NewsList, TaskList } from "./PlazaLists";

// 펼침·접힘 고른 것은 이 브라우저에 남긴다. 저장소를 못 쓰면(사생활 보호 창) 이 화면에서만 기억한다
const KEY = "bv-plaza-drawer";
const EVENT = "bv-plaza-drawer";
type Open = "auto" | "1" | "0";
let memory: Open | null = null;
const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};
const readOpen = (): Open => {
  if (memory) return memory;
  try {
    const value = localStorage.getItem(KEY);
    return value === "1" || value === "0" ? value : "auto";
  } catch {
    return "auto";
  }
};
function choose(value: "1" | "0") {
  memory = value;
  try {
    localStorage.setItem(KEY, value);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

type Tab = "news" | "tasks";

/**
 * 광장 소식 서랍 (광장 개편): 화면 오른쪽 위 종이 쪽지. [이웃 새 글]과 [오늘 할 일] 두 탭, 공지 띠가 켜져 있으면 맨 위 한 줄.
 * 폭 280px. 고른 적이 없으면 1440px 이상에서만 펼쳐 두고(CSS가 정해 첫 그림부터 맞다), 그보다 좁으면 접힌 탭 하나라
 * 1280px 시작 화면의 상점을 가리지 않는다. 고른 것은 기억한다. 시험 훅 `data-town-drawer`(`data-open`: auto|1|0).
 * 방문자는 할 일이 없어 마을 소식만.
 */
export function PlazaDrawer({
  news,
  tasks,
  places,
  notice,
  member,
  onTeleport,
}: {
  news: PlazaNews;
  /** 회원의 오늘 할 일 (방문자는 null) */
  tasks: readonly TodayTask[] | null;
  places: readonly TownSpot[];
  notice: { text: string; link: string | null } | null;
  member: boolean;
  onTeleport: (spot: TownSpot) => void;
}) {
  const open = useSyncExternalStore(subscribe, readOpen, () => "auto" as const);
  const [tab, setTab] = useState<Tab>("news");
  const id = useId();
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ news: null, tasks: null });
  const title = member ? "이웃 새 글" : "마을 소식";
  // 접힌 탭의 숫자: 24시간 안에 쓴 글 (광장에서 불이 켜진 집). 이웃 글이 없어 마을 전체를 보일 때는 세지 않는다
  const lit = member && news.scope === "village" ? 0 : news.posts.filter((p) => p.fresh).length;
  const done = tasks?.filter((t) => t.done).length ?? 0;
  const tabs: Tab[] = tasks ? ["news", "tasks"] : ["news"];

  // ←·→로 탭을 옮긴다. 게임이 방향키로 걷지 않게 창 밖(window)으로 보내지 않는다
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    event.stopPropagation();
    const next = tabs[(tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <aside aria-label="광장 소식" className="group/drawer pointer-events-none absolute right-3 top-3 z-20 flex max-h-[calc(100%-5.5rem)] flex-col items-end" data-town-drawer data-open={open}>
      {/* 접힌 탭 (고른 적 없으면 1440px 미만에서만) */}
      <div className="pointer-events-auto group-data-[open=1]/drawer:hidden min-[1440px]:group-data-[open=auto]/drawer:hidden">
        <button
          type="button"
          className="px-plank px-float flex min-h-11 items-center gap-2 px-3 font-bold"
          aria-expanded="false"
          aria-controls={`${id}-body`}
          aria-label={`${title} 펼치기${lit > 0 ? `, 24시간 안에 쓴 글 ${lit}편` : ""}`}
          onClick={() => choose("1")}
          data-drawer-toggle
        >
          <span aria-hidden="true">📰</span>
          {title}
          {lit > 0 && (
            <span className="px-chip" data-tone="sun">
              {lit}
            </span>
          )}
        </button>
      </div>

      {/* 펼친 서랍 */}
      <div
        id={`${id}-body`}
        className="px-box px-float pointer-events-auto hidden min-h-0 w-[280px] flex-col group-data-[open=1]/drawer:flex min-[1440px]:group-data-[open=auto]/drawer:flex"
      >
        {notice && (
          <p className="bg-(--kit-glow)/45 px-3 py-2 text-sm font-semibold break-words" data-town-notice>
            <span aria-hidden="true">📢 </span>
            {notice.link ? (
              <Link href={notice.link} className="underline underline-offset-2">
                {notice.text}
              </Link>
            ) : (
              notice.text
            )}
          </p>
        )}
        <div className="px-box-head flex items-end gap-1 pl-2 pr-1 pt-2">
          {tasks ? (
            <div role="tablist" aria-label="광장 소식" className="px-tabs min-w-0 flex-1">
              {tabs.map((t) => (
                <button
                  key={t}
                  ref={(el) => {
                    tabRefs.current[t] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`${id}-${t}`}
                  aria-selected={tab === t}
                  aria-controls={`${id}-panel`}
                  tabIndex={tab === t ? 0 : -1}
                  className="px-tab"
                  onClick={() => setTab(t)}
                  onKeyDown={onTabKey}
                >
                  {t === "news" ? (
                    <>
                      {title}
                      {lit > 0 && (
                        <span className="px-chip" data-tone="sun">
                          {lit}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      오늘 할 일
                      <span className="px-chip">
                        {done}/{tasks.length}
                      </span>
                    </>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <h2 className="min-w-0 flex-1 px-1 pb-2 font-bold">{title}</h2>
          )}
          <button type="button" className="px-btn px-btn--quiet px-btn--sm mb-1 shrink-0" aria-label="광장 소식 접기" aria-expanded="true" onClick={() => choose("0")} data-drawer-toggle>
            »
          </button>
        </div>
        <div
          id={`${id}-panel`}
          role={tasks ? "tabpanel" : undefined}
          aria-labelledby={tasks ? `${id}-${tab}` : undefined}
          className="min-h-0 flex-1 overflow-y-auto py-1"
          data-drawer-panel={tab}
        >
          {tab === "news" || !tasks ? <NewsList news={news} compact member={member} /> : <TaskList tasks={tasks} places={places} onTeleport={onTeleport} />}
        </div>
      </div>
    </aside>
  );
}
