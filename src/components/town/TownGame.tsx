"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { findArt } from "@/lib/art";
import { pixelRects, type PixelArt } from "@/lib/art/characters";
import { TOWN_CELL } from "@/lib/art/town";
import { PLAYER_SIZE, SPEED, WORLD, nearestEntrance, normalize, step, type Point } from "@/lib/town/layout";
import { artSize, artVisibleHeight, entrancePrompt, townLayout, type TownEntrance, type TownHouseInput } from "@/lib/town/structures";
import { bakeGround, GROUND_CELL } from "./ground";

/** 휴대폰에는 마을이 없다 (TOWN-01): 폭 640px 미만 */
export const PHONE_MEDIA = "(max-width: 639px)";

const MOVE_KEYS: Record<string, Point> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyW: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

function subscribePhone(onChange: () => void) {
  const media = window.matchMedia(PHONE_MEDIA);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** 도트 그림을 칸 `scale`px짜리 캔버스로 한 번 굽는다 */
function bake(arts: readonly PixelArt[], scale: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = arts[0].rows[0].length * scale;
  canvas.height = arts[0].rows.length * scale;
  const ctx = canvas.getContext("2d")!;
  for (const art of arts) {
    for (const r of pixelRects(art)) {
      ctx.fillStyle = r.fill;
      ctx.fillRect(r.x * scale, r.y * scale, r.width * scale, scale);
    }
  }
  return canvas;
}

/** 키를 게임에 주지 않을 곳: 글자 칸, 그리고 버튼·링크 위의 Enter·Space (NF-18) */
function yieldsKey(event: KeyboardEvent): boolean {
  // 레벨업 팝업 같은 창이 열려 있으면 게임은 키보드를 쓰지 않는다
  if (document.querySelector("dialog[open]")) return true;
  // 브라우저·운영체제 단축키 (Alt+← 뒤로 가기, Ctrl+A 등)
  if (event.ctrlKey || event.metaKey || event.altKey) return true;
  const el = event.target as HTMLElement | null;
  if (!el || el === document.body) return false;
  if (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return true;
  if ((event.code === "Space" || event.code === "Enter") && el.closest("a,button,[role=button],dialog")) return true;
  return false;
}

function drawTag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bold: boolean, sub?: string) {
  ctx.font = `${bold ? "700" : "500"} 13px system-ui, sans-serif`;
  const width = Math.max(ctx.measureText(text).width, sub ? ((ctx.font = "500 11px system-ui, sans-serif"), ctx.measureText(sub).width) : 0) + 14;
  const height = sub ? 34 : 20;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - height, width, height, 6);
  ctx.fill();
  ctx.fillStyle = "#3b2a20";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${bold ? "700" : "500"} 13px system-ui, sans-serif`;
  ctx.fillText(text, x, y - height + 10);
  if (sub) {
    ctx.font = "500 11px system-ui, sans-serif";
    ctx.fillStyle = "#7a6a5a";
    ctx.fillText(sub, x, y - 10);
  }
}

/**
 * 마을 게임 (TOWN-01~04, specs/038-town): 캔버스 하나에 바닥·건물·집·나무·캐릭터를 그린다.
 * 방향키·WASD·클릭으로 걷고, 입구 앞에서 Space·Enter(또는 건물 클릭)로 들어간다.
 * 시험용으로 캔버스에 발 위치 `data-feet`를 적고, `bv-teleport` 이벤트(`{x, y}`)로 옮길 수 있다.
 */
export function TownGame({
  houses,
  member,
  layers,
  name,
  start,
  startKey,
}: {
  houses: TownHouseInput[];
  member: boolean;
  layers: string[];
  name: string;
  start: Point;
  /** 시작 자리를 고른 주소 값(`?at`). 같으면 다시 만들 때 서 있던 자리를 이어 쓴다 */
  startKey: string;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 즐겨찾기를 바꿔 집 목록이 다시 오면 게임을 다시 만들되 서 있던 자리는 그대로 (TOWN-12 친구 목록)
  const lastPos = useRef<{ from: string; pos: Point } | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [touch, setTouch] = useState(false);
  const data = JSON.stringify({ houses, member, layers, name, start, startKey });
  // 창 폭이 휴대폰 조건을 넘나들면 게임을 끄고 다시 만든다
  const phone = useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_MEDIA).matches,
    () => false,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || phone) return;
    const { houses, member, layers, name, start, startKey } = JSON.parse(data) as {
      houses: TownHouseInput[];
      member: boolean;
      layers: string[];
      name: string;
      start: Point;
      startKey: string;
    };
    setTouch(window.matchMedia("(pointer: coarse)").matches);
    const ctx = canvas.getContext("2d")!;
    const { structures, entrances } = townLayout(houses, member);
    const bodies = structures.flatMap((s) => (s.body ? [s.body] : []));
    const sprites = new Map<object, HTMLCanvasElement>();
    for (const s of structures) if (!sprites.has(s.art)) sprites.set(s.art, bake([s.art], TOWN_CELL));
    const playerArts = layers.map(findArt).filter((a): a is PixelArt => a !== undefined);
    const player = playerArts.length > 0 ? bake(playerArts, PLAYER_SIZE / 16) : null;
    const ground = bakeGround();

    // 시작 자리(?at)가 바뀌었으면 새 자리에서. 환영(?welcome)을 주소에서 지운 뒤 다시 그려도 자리는 그대로
    const from = startKey;
    let pos: Point = lastPos.current?.from === from ? lastPos.current.pos : { ...start };
    let target: Point | null = null;
    let enterNext = false;
    let facingLeft = false;
    let walkTime = 0;
    let shown: string | null = null;
    let stuck = 0;
    const held = new Set<string>();
    const camera = { x: 0, y: 0 };

    const go = (e: TownEntrance) => router.push(e.href === "login" ? "/" : e.href);

    // 화면 배율(devicePixelRatio)만큼 캔버스를 키워 고해상도 화면에서도 또렷하게. 그리는 좌표는 CSS px
    let dpr = 1;
    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const onKeyDown = (event: KeyboardEvent) => {
      // 게임이 보이지 않으면(휴대폰 폭으로 줄인 사이) 키를 가져가지 않는다
      if (canvas.clientWidth === 0 || yieldsKey(event)) return;
      if (MOVE_KEYS[event.code]) {
        held.add(event.code);
        target = null;
        event.preventDefault();
      } else if (event.code === "Space" || event.code === "Enter") {
        enterNext = true;
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      // Cmd를 누른 동안에는 다른 키를 뗀 신호가 오지 않아(macOS) Cmd를 떼면 모두 비운다
      if (event.key === "Meta") held.clear();
      else held.delete(event.code);
    };
    const onBlur = () => held.clear();
    const toWorld = (event: PointerEvent): Point => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left + camera.x,
        y: event.clientY - rect.top + camera.y,
      };
    };
    const onPointer = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const p = toWorld(event);
      // 건물·집을 눌렀으면 그 입구로 (가까우면 바로 들어간다)
      const hit = structures.find((s) => {
        const { width, height } = artSize(s.art);
        return p.x >= s.x - width / 2 && p.x <= s.x + width / 2 && p.y >= s.y - height && p.y <= s.y;
      });
      const door = hit && entrances.filter((e) => e.id === hit.id || (hit.id === "board" && (e.id === "feed" || e.id === "attendance")));
      if (door && door.length > 0) {
        const e = door.length === 1 ? door[0] : p.x < hit.x ? door[0] : door[1];
        if (Math.hypot(e.x - pos.x, e.y - pos.y) <= 90) return go(e);
        target = { x: e.x, y: e.y };
      } else {
        target = p;
      }
    };
    const onTeleport = (event: Event) => {
      const { x, y } = (event as CustomEvent<Point>).detail;
      pos = { x, y };
      target = null;
    };
    // 헤더 🏘 마을 링크에 포커스가 남아 있으면 Space·Enter가 그 링크로 가므로 놓아 준다
    if (document.activeElement instanceof HTMLElement && !document.activeElement.closest("[data-town]")) document.activeElement.blur();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    canvas.addEventListener("pointerdown", onPointer);
    canvas.addEventListener("bv-teleport", onTeleport);

    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // 움직이기: 키보드가 클릭 목표보다 먼저
      let dx = 0;
      let dy = 0;
      for (const code of held) {
        dx += MOVE_KEYS[code].x;
        dy += MOVE_KEYS[code].y;
      }
      if (dx === 0 && dy === 0 && target) {
        if (Math.hypot(target.x - pos.x, target.y - pos.y) < 4) target = null;
        else {
          dx = target.x - pos.x;
          dy = target.y - pos.y;
        }
      }
      const dir = normalize(dx, dy);
      const moving = dir.x !== 0 || dir.y !== 0;
      if (moving) {
        const next = step(pos, { x: dir.x * SPEED * dt, y: dir.y * SPEED * dt }, bodies);
        // 클릭 목표로 가다 막히면 멈춘다
        stuck = Math.hypot(next.x - pos.x, next.y - pos.y) < 0.5 ? stuck + dt : 0;
        if (stuck > 0.25) target = null;
        if (dir.x !== 0) facingLeft = dir.x < 0;
        pos = next;
        walkTime += dt;
      }

      // 입구 안내, 그리고 Space·Enter (멀리서 누른 것은 버린다)
      const near = nearestEntrance(pos, entrances);
      const text = near ? entrancePrompt(near) : null;
      if (text !== shown) {
        shown = text;
        setPrompt(text);
      }
      if (enterNext) {
        enterNext = false;
        if (near) go(near);
      }

      // 카메라
      const vw = canvas.clientWidth;
      const vh = canvas.clientHeight;
      camera.x = vw >= WORLD.width ? (WORLD.width - vw) / 2 : Math.min(Math.max(pos.x - vw / 2, 0), WORLD.width - vw);
      camera.y = vh >= WORLD.height ? (WORLD.height - vh) / 2 : Math.min(Math.max(pos.y - vh / 2, 0), WORLD.height - vh);
      camera.x = Math.round(camera.x);
      camera.y = Math.round(camera.y);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#5fa34f";
      ctx.fillRect(0, 0, vw, vh);
      ctx.drawImage(ground, camera.x / GROUND_CELL, camera.y / GROUND_CELL, vw / GROUND_CELL, vh / GROUND_CELL, 0, 0, vw, vh);

      // 아랫변 y 순서로 그린다 (앞에 있는 것이 위에)
      type Item = { y: number; draw: () => void };
      const items: Item[] = [];
      for (const s of structures) {
        const { width, height } = artSize(s.art);
        const left = s.x - width / 2 - camera.x;
        const top = s.y - height - camera.y;
        if (left > vw || top > vh || left + width < 0 || top + height + 40 < 0) continue;
        items.push({
          y: s.y,
          draw: () => {
            ctx.fillStyle = "rgba(0,0,0,0.12)";
            ctx.beginPath();
            ctx.ellipse(left + width / 2, top + height - 2, width * 0.42, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.drawImage(sprites.get(s.art)!, Math.round(left), Math.round(top));
          },
        });
      }
      const bob = moving ? Math.round(Math.abs(Math.sin(walkTime * 12)) * 3) : 0;
      items.push({
        y: pos.y + 8,
        draw: () => {
          const px = Math.round(pos.x - camera.x);
          const py = Math.round(pos.y - camera.y);
          ctx.fillStyle = "rgba(0,0,0,0.18)";
          ctx.beginPath();
          ctx.ellipse(px, py, 16, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          if (player) {
            ctx.save();
            ctx.translate(px, py - PLAYER_SIZE - bob + 4);
            if (facingLeft) ctx.scale(-1, 1);
            ctx.drawImage(player, -PLAYER_SIZE / 2, 0);
            ctx.restore();
          }
        },
      });
      items.sort((a, b) => a.y - b.y);
      for (const item of items) item.draw();
      // 이름표는 맨 위에
      for (const s of structures) {
        if (!s.label) continue;
        const height = artVisibleHeight(s.art);
        const x = s.x - camera.x;
        const y = s.y - height - camera.y - 4;
        if (x < -150 || x > vw + 150 || y < -20 || y > vh + 60) continue;
        drawTag(ctx, s.label, x, y, s.id === "house:0", s.sub);
      }
      drawTag(ctx, name, pos.x - camera.x, pos.y - camera.y - PLAYER_SIZE - bob, true);
      lastPos.current = { from, pos };
      if (frame++ % 3 === 0) canvas.dataset.feet = `${Math.round(pos.x)},${Math.round(pos.y)}`;
      raf = requestAnimationFrame(tick);
    };
    let raf = requestAnimationFrame(tick);
    canvas.dataset.ready = "1";
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("pointerdown", onPointer);
      canvas.removeEventListener("bv-teleport", onTeleport);
      delete canvas.dataset.ready;
    };
  }, [data, phone, router]);

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none select-none"
        aria-label="마을 지도. 방향키로 걷고 Space로 들어가요"
        data-feet={`${start.x},${start.y}`}
        // 시험 훅: 집 자리마다 지붕 색 (TOWN-07)
        data-roofs={houses.map((h) => `${h.lot}:${h.roof}`).join(" ")}
      />
      <p
        role="status"
        className={`pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-full bg-black/75 px-4 py-2 text-sm font-semibold text-white ${prompt ? "" : "hidden"}`}
        data-town-prompt
      >
        {prompt}
      </p>
      <p className="pointer-events-none absolute bottom-3 right-3 rounded-lg bg-white/85 px-3 py-1.5 text-xs text-[#5a4a3a]" data-town-hint>
        {touch ? "탭으로 이동 · 건물을 탭해서 들어가기" : "방향키·WASD 또는 클릭으로 이동 · 건물 앞에서 Space로 들어가기"}
      </p>
    </div>
  );
}
