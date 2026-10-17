"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent } from "react";
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
 * 폭 280px. 고른 적이 없으면 1680px 이상에서만 펼쳐 두고(CSS가 정해 첫 그림부터 맞다), 그보다 좁으면 접힌 탭 하나라
 * 시작 화면의 상점과 동쪽 이웃 집(불 켜진 창)을 가리지 않는다. 고른 것은 기억한다. 시험 훅 `data-town-drawer`(`data-open`: auto|1|0).
 * 이웃 글이 없어 마을 전체 새 글을 보이면(`village`) 탭 이름도 '마을 소식'. 방문자는 할 일이 없어 마을 소식만.
 * 친구 마을(`host`)은 그 마을 이웃의 새 글이다 (목록이 그렇게 적는다).
 * 펼치기·접기를 키보드로 누르면 그 버튼이 숨으니 초점을 짝 버튼(펼친 탭·[»], 접힌 탭)으로 옮긴다. 마우스로 누르면 초점을 놓아 다음 Space가 게임으로 간다.
 */
export function PlazaDrawer({
  news,
  tasks,
  places,
  notice,
  member,
  host = null,
  onTeleport,
}: {
  news: PlazaNews;
  /** 회원의 오늘 할 일 (방문자는 null) */
  tasks: readonly TodayTask[] | null;
  places: readonly TownSpot[];
  notice: { text: string; link: string | null } | null;
  member: boolean;
  /** 친구 마을 구경이면 그 마을 주인 (TOWN-15) */
  host?: { nickname: string; slug: string } | null;
  onTeleport: (spot: TownSpot) => void;
}) {
  const open = useSyncExternalStore(subscribe, readOpen, () => "auto" as const);
  const [tab, setTab] = useState<Tab>("news");
  const id = useId();
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ news: null, tasks: null });
  const foldRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // 키보드로 펼치기·접기를 눌렀다: 바뀐 뒤 짝 버튼으로 초점을 옮긴다
  const moveFocus = useRef(false);
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    (open === "1" ? (tabRefs.current[tab] ?? closeRef.current) : foldRef.current)?.focus();
  }, [open, tab]);
  const toggleTo = (value: "1" | "0") => (event: MouseEvent<HTMLButtonElement>) => {
    // 키보드(Enter·Space)로 누른 클릭은 detail이 0
    moveFocus.current = event.detail === 0;
    if (event.detail !== 0) event.currentTarget.blur();
    choose(value);
  };
  const title = member && news.scope === "neighbors" ? "이웃 새 글" : "마을 소식";
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
      {/* 접힌 탭 (고른 적 없으면 1680px 미만에서만). 768px 미만은 왼쪽 간판 묶음과 부딪히지 않게 글자를 접는다 (이름은 aria-label) */}
      <div className="pointer-events-auto group-data-[open=1]/drawer:hidden min-[1680px]:group-data-[open=auto]/drawer:hidden">
        <button
          ref={foldRef}
          type="button"
          className="px-plank px-float flex min-h-11 min-w-11 items-center justify-center gap-2 px-3 font-bold whitespace-nowrap"
          aria-expanded="false"
          aria-controls={`${id}-body`}
          // 이름은 보이는 글자(제목·숫자)로 시작한다 (말로 누르기, WCAG 2.5.3)
          aria-label={`${title}${lit > 0 ? ` ${lit}` : ""} 펼치기${lit > 0 ? `, 24시간 안에 쓴 글 ${lit}편` : ""}`}
          onClick={toggleTo("1")}
          data-drawer-toggle
        >
          <span aria-hidden="true">📰</span>
          <span className="max-md:hidden">{title}</span>{" "}
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
        className="px-box px-float pointer-events-auto hidden min-h-0 w-[280px] flex-col group-data-[open=1]/drawer:flex min-[1680px]:group-data-[open=auto]/drawer:flex"
      >
        {/* 햇빛 종이 바탕 (다크 화면에서는 어두운 햇빛색이라 먹색 글자가 뒤집혀도 대비가 맞다) */}
        {notice && (
          <p className="bg-(--kit-sun-paper) px-3 py-2 text-sm font-semibold break-words" data-town-notice>
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
                  className="px-tab whitespace-nowrap"
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
          <button
            ref={closeRef}
            type="button"
            className="px-btn px-btn--quiet px-btn--sm mb-1 shrink-0"
            aria-label="광장 소식 접기"
            aria-expanded="true"
            onClick={toggleTo("0")}
            data-drawer-toggle
          >
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
          {tab === "news" || !tasks ? <NewsList news={news} compact member={member} host={host} /> : <TaskList tasks={tasks} places={places} onTeleport={onTeleport} />}
        </div>
      </div>
    </aside>
  );
}
