"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { findArt } from "@/lib/art";
import type { PixelArt } from "@/lib/art/characters";
import { walkFrame, WALK_FPS, WALK_FRAMES, type WalkDir } from "@/lib/art/walk";

const DIRS: readonly { dir: WalkDir; label: string }[] = [
  { dir: "down", label: "앞" },
  { dir: "left", label: "왼쪽" },
  { dir: "up", label: "뒤" },
  { dir: "right", label: "오른쪽" },
];

const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (onChange: () => void) => {
  const query = window.matchMedia(REDUCE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/** 움직임 줄이기를 켠 기기인지 (서버 그림은 움직이는 쪽으로 그린 뒤 맞춘다) */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(REDUCE).matches,
    () => false,
  );
}

/** 거울 그림: 고른 모습이 그 방향으로 걷는다 */
function MirrorArt({ layers, dir, walking }: { layers: readonly string[]; dir: WalkDir; walking: boolean }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!walking) return;
    const timer = setInterval(() => setFrame((f) => (f % WALK_FRAMES) + 1), 1000 / WALK_FPS);
    return () => clearInterval(timer);
  }, [walking]);
  const arts = layers.flatMap((k) => {
    const a = findArt(k);
    return a ? [a] : ([] as PixelArt[]);
  });
  const grid = walkFrame(arts, dir, walking ? frame : 0);
  return (
    <svg viewBox="0 0 16 16" width={192} height={192} shapeRendering="crispEdges" role="img" aria-label="거울에 비친 내 모습" data-mirror={layers.join(" ")} data-mirror-dir={dir}>
      {grid.flatMap((row, y) => row.map((color, x) => (color ? <rect key={`${x}:${y}`} x={x} y={y} width={1} height={1} fill={color} /> : null)))}
    </svg>
  );
}

/**
 * 옷가게·미용실의 거울 (나무 틀 + 유리)과 [앞·왼쪽·뒤·오른쪽][멈춤] 돌려 보기.
 * 움직임 줄이기를 켠 기기에서는 처음부터 멈춘 모습이고, [▶ 걷기]를 누르면 걷는다.
 */
export function WalkingMirror({ layers }: { layers: readonly string[] }) {
  const reduce = useReducedMotion();
  const [dir, setDir] = useState<WalkDir>("down");
  // null이면 기기 설정을 따른다 (누른 뒤에는 누른 대로)
  const [chosen, setChosen] = useState<boolean | null>(null);
  const walking = chosen ?? !reduce;
  return (
    <>
      <div className="px-mirror">
        <div>
          <MirrorArt layers={layers} dir={dir} walking={walking} />
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="돌려 보기">
        {DIRS.map((d) => (
          <button key={d.dir} type="button" className="px-btn px-btn--sm" aria-pressed={dir === d.dir} onClick={() => setDir(d.dir)}>
            {d.label}
          </button>
        ))}
        {/* 글자가 누르면 할 일을 말하는 보통 버튼 (눌림 상태를 함께 바꾸면 '멈춤이 켜짐'처럼 두 번 뒤집혀 읽힌다) */}
        <button type="button" className="px-btn px-btn--sm" onClick={() => setChosen(!walking)}>
          {walking ? "⏸ 멈춤" : "▶ 걷기"}
        </button>
      </div>
    </>
  );
}
