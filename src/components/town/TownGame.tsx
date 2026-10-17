"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { findArt } from "@/lib/art";
import { pixelRects, type PixelArt } from "@/lib/art/characters";
import { walkDir, walkFrame, WALK_DIRS, WALK_FPS, WALK_FRAMES, type ColorGrid, type WalkDir } from "@/lib/art/walk";
import {
  cellGroups,
  chimneyTop,
  darken,
  glowCells,
  lampArt,
  LANTERN,
  lanternArt,
  litHouseArt,
  LIT_GLOW,
  mailboxArt,
  markerArt,
  smokeArt,
  SMOKE_FRAMES,
  snowCap,
  sparkArt,
  SPARK_FRAMES,
  TOWN_CELL,
  treeArt,
  withEaveLantern,
} from "@/lib/art/town";
import { BOARD_POS, entranceDistance, HOUSE_LOTS, INTERACT_DISTANCE, lotFront, PLAYER_SIZE, shortName, SPEED, subSteps, WORLD, nearestEntrance, normalize, type Point } from "@/lib/town/layout";
import { createNpcs, neighborArt, NPC_TAG_DISTANCE, npcGraph, updateNpcs, type Npc } from "@/lib/town/npc";
import { slideStep, WalkGrid } from "@/lib/town/path";
import {
  artSize,
  artVisibleHeight,
  BOARD_DOORS,
  BOARD_PLANK_LIFT,
  entranceOwner,
  entrancePrompt,
  hasNews,
  lanternPlacements,
  lanternRopes,
  lanternSlots,
  lotChoice,
  mailboxLot,
  mastTop,
  ropePoint,
  structureAt as structureAtPoint,
  townLayout,
  type BoardState,
  type Structure,
  type TownEntrance,
  type TownHouseInput,
} from "@/lib/town/structures";
import { emitTown, onTown } from "@/lib/town/events";
import { DUSK_GLOW, lampsOn, msUntilNextSky, skyAt, SKY_TINT, type Sky } from "@/lib/town/sky";
import { zoneAt, type Zone } from "@/lib/town/zones";
import { todayKST } from "@/lib/kst";
import type { TodayTask } from "@/lib/town/plaza";
import { seasonAt, type Season } from "@/lib/town/season";
import { onStairs, SKY_HEIGHT, STAIR_SLOW, stairEnds, STAIRS } from "@/lib/town/terrain";
import { bubbleWithAge, PIXEL_FONT_PROBE, TagCache } from "./canvas-text";
import { bakeGlow, bakeGround, bakeSkyBand, bakeStars, GROUND_CELL } from "./ground";
import { COMPACT_EVENT } from "./PlaceSign";

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

/** 집 문패가 보이는 거리 (px). 내 집 문패는 늘 보인다 */
const PLATE_DISTANCE = 260;
/** 빈 집터 팻말이 보이는 거리 */
const LOT_DISTANCE = 200;
/** 글 쓴 이웃이 새 글 제목 말풍선을 띄우는 거리 (가장 가까운 한 명만) */
const BUBBLE_DISTANCE = 160;
/** 입구 안내 말풍선을 입구(내가 더 위에 있으면 내 발밑) 위로 띄우는 높이: 내 이름표 바로 위 */
const PROMPT_LIFT = 96;
/** 입구 안내 말풍선의 윗변은 적어도 이만큼 아래부터: 화면 위 간판 묶음(☰·지갑·글쓰기, 장소 간판, 그림자 포함 60px)에 가리지 않게 */
const PROMPT_TOP = 72;
/** 안내 말풍선과 터치 [들어가기] 버튼 사이 (ml-3), 말풍선 아래 꼬리 자리 (pb-[10px]) */
const ENTER_GAP = 12;
const PROMPT_TAIL = 10;
/** 입구 안내 글에서 동작을 가르는 곳 (`🏪 상점 · Space 들어가기`) */
const PROMPT_SPLIT = " · Space ";
/** 물·연기 그림을 바꾸는 간격: 초당 3장, 뚝뚝 끊어서 (도트 그림 움직임) */
const ANIM_MS = 333;
/** 하늘마다 불빛 세기 (낮은 끈다) */
const LIGHT: Record<Sky, number> = { dawn: 0.6, day: 0, dusk: 0.8, night: 1 };
/** 따뜻한 등불 빛 (RGB) */
const WARM = [255, 164, 72] as const;
/** 초롱 빛 무리 (RGB, #ffe9a6) */
const LANTERN_LIGHT = [255, 233, 166] as const;
/** 세계 밖 숲 띠 폭 (px) */
const EDGE_FOREST = 480;
/** 클릭한 길을 땅에 보이는 시간 (ms): 마지막 `ROUTE_FADE_MS` 동안 흐려진다 */
const ROUTE_MS = 1200;
const ROUTE_FADE_MS = 400;
/** 게시판(`BOARD_POS`)에서 이만큼 안에 서면 위 가운데 장소 간판을 접는다 (게시판 이름표를 가리지 않게) */
const BOARD_COMPACT = 220;
/** 이웃이 자기 집 문 앞 이만큼 안에 서 있으면 입구 안내와 새 글 말풍선을 한 줄로 합친다 */
const DOORSTEP = 70;
/** 초롱 아래 선 자리에서 이만큼 안에 멈춰 서야 초롱 안내가 뜬다 (px, D3) */
const LANTERN_REACH = 44;
/** 줄등 초롱이 흔들리는 간격 (ms, 두 장) */
const SWAY_MS = 700;
/** 글 쓰고 돌아온 순간 (C2): 창이 하나씩 켜지는 간격, 처음 쉬는 시간, 쪽지가 떠 있는 시간 (ms) */
const CELEBRATE = { first: 500, gap: 380, note: 7000 } as const;
/** 불꽃 한 장 (ms) */
const SPARK_MS = 110;

/** 그림에서 고른 글자 칸만 남기고 글자마다 색을 준 덧칠 그림 (밤 지붕 다시 칠하기) */
function cellsOnly(source: PixelArt, colors: Record<string, string>): PixelArt {
  const keep = new Set(Object.keys(colors));
  return { rows: source.rows.map((r) => [...r].map((c) => (keep.has(c) ? c : ".")).join("")), palette: colors };
}

/** 글자 `ch`가 이어진 덩어리마다 그 칸들 */
function cellBlobs(source: PixelArt, ch: string): [number, number][][] {
  const seen = new Set<string>();
  const out: [number, number][][] = [];
  source.rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== ch || seen.has(`${x},${y}`)) return;
      const blob: [number, number][] = [];
      const stack: [number, number][] = [[x, y]];
      seen.add(`${x},${y}`);
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        blob.push([cx, cy]);
        for (const [nx, ny] of [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ]) {
          if (source.rows[ny]?.[nx] === ch && !seen.has(`${nx},${ny}`)) {
            seen.add(`${nx},${ny}`);
            stack.push([nx, ny]);
          }
        }
      }
      out.push(blob);
    }),
  );
  return out;
}

/**
 * 글 쓰고 돌아온 순간의 단계 그림 (C2): 0단계는 창과 처마 초롱이 모두 꺼진 집, k단계는 앞의 k개가 켜진 집.
 * 창은 1층부터 왼쪽에서 오른쪽으로, 처마 초롱이 맨 끝이다. 칸 배치는 같아 몸체·이름표 자리가 같다.
 */
function celebrateStages(lit: PixelArt): PixelArt[] {
  const mid = (b: [number, number][]) => b.reduce((a, [x, y]) => ({ x: a.x + x / b.length, y: a.y + y / b.length }), { x: 0, y: 0 });
  const windows = cellBlobs(lit, "G").sort((a, b) => mid(b).y - mid(a).y || mid(a).x - mid(b).x);
  const lanterns = cellBlobs(lit, "J");
  const groups = [...windows, ...lanterns];
  const lanternAt = lanterns.length > 0 ? windows.length : -1;
  return Array.from({ length: groups.length + 1 }, (_, k) => {
    const rows = lit.rows.map((r) => [...r]);
    groups.forEach((cells, i) => {
      if (i >= k) for (const [x, y] of cells) rows[y][x] = rows[y][x] === "J" ? "v" : "u";
    });
    const lanternOff = lanternAt >= 0 && k <= lanternAt;
    return {
      rows: rows.map((r) => r.join("")),
      palette: { ...lit.palette, u: "#bfe6ff", v: LANTERN.offRed, ...(lanternOff ? { M: LANTERN.offRed, U: LANTERN.offBlue, y: "#a8946a" } : {}) },
    };
  });
}

/** 날짜 하나에 한 번만 (이 기기): 처음이면 true를 돌려주고 적어 둔다. 저장소를 못 쓰면 늘 true */
function firstToday(key: string): boolean {
  try {
    const name = `${key}-${todayKST()}`;
    if (localStorage.getItem(name)) return false;
    localStorage.setItem(name, "1");
  } catch {
    // 저장소를 못 쓰면 매번 보인다
  }
  return true;
}

function subscribePhone(onChange: () => void) {
  const media = window.matchMedia(PHONE_MEDIA);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** 지금 창 폭이 휴대폰 조건(`PHONE_MEDIA`)인가. 서버 그림과 첫 그림은 false (효과를 켜고 끄는 데만 쓴다) */
export function usePhoneWidth(): boolean {
  return useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_MEDIA).matches,
    () => false,
  );
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

/** 색 칸(걷는 그림 한 칸)을 칸 `scale`px짜리 캔버스로 굽는다 */
function bakeGrid(grid: ColorGrid, scale: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = grid[0].length * scale;
  canvas.height = grid.length * scale;
  const ctx = canvas.getContext("2d")!;
  grid.forEach((row, y) =>
    row.forEach((color, x) => {
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }),
  );
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

/**
 * 입구 안내 글: 문구(textContent)는 그대로 두고 `Space`만 키 모양으로, 가운뎃점은 화면 낭독기에만.
 * 터치 화면은 키가 없고 옆에 [들어가기] 버튼이 있어 장소 이름만 보이고 나머지는 화면 낭독기에만
 */
function PromptText({ text, touch = false }: { text: string; touch?: boolean }) {
  const at = text.indexOf(PROMPT_SPLIT);
  if (at < 0) return <>{text}</>;
  if (touch)
    return (
      <>
        {text.slice(0, at)}
        <span className="sr-only">{text.slice(at)}</span>
      </>
    );
  return (
    <>
      {text.slice(0, at)}
      <span className="sr-only"> · </span>
      <kbd className="px-key ml-2">Space</kbd>
      <span className="font-medium">{text.slice(at + 8)}</span>
    </>
  );
}

/** 조작 안내를 몇 번 본 뒤에는 `?` 팻말로 접는다 (이 기기에서 마을을 연 횟수) */
const HINT_VISITS = "bv-town-visits";
const HINT_FOLD_AFTER = 3;

/**
 * 마을 게임 (TOWN-01~04, specs/038-town): 캔버스 하나에 바닥·건물·집·나무·캐릭터를 그린다.
 * 방향키·WASD·클릭으로 걷고, 입구 앞에서 Space·Enter(또는 건물 클릭)로 들어간다. 멀리 있는 건물을 누르면 문 앞까지 걸어가 들어간다.
 * 시험용으로 캔버스에 발 위치 `data-feet`를 적고, `bv-teleport` 이벤트(`{x, y}`)로 옮길 수 있다.
 * 우체통 입구는 페이지를 옮기지 않고 창 밖(window)에 `bv-mailbox` 이벤트(`{lot}`)를 보낸다 (TOWN-13, `TownHud`가 연다).
 * 내 마을(`chooseLots`)의 빈 집터는 `bv-lots` 이벤트(`{lot}`)로 자리 고르기 창을 연다 (TOWN-18).
 * 집이 선 이웃은 흙길을 걸어 다니고(TOWN-19), 누르면 그 집 우체통이 열린다. 시험 훅 `data-npcs`·`data-npc-walking`·`data-npc-at`.
 *
 * 등불 마을 (광장 개편 "글 쓴 집에 불이 켜진다"): 하늘이 한국 시각을 따르고(`data-sky`), 노을·밤·새벽에는 세계를 한 번 덧칠한 뒤
 * 가로등과 24시간 안에 글을 쓴 집(`data-lit`)의 창에 불빛을 더한다. 글 쓴 집은 낮에도 창이 따뜻하고 굴뚝에 연기가 난다.
 * 게시판은 오늘 새 글 쪽지와 출석 도장을 보인다(`data-board`). 이벤트: `bv-mail`(내 우체통 깃발), `bv-enter`(들어가기),
 * `bv-panel`(창이 열리면 멀리서 누른 건물에 걸어가 들어가기를 그만둔다)을 듣고, 구역이 바뀌면 `bv-zone`을 보낸다.
 * 창이 열린 채 캔버스를 누르면 HUD가 창을 닫고(`TownHud`), 같은 클릭은 여기서 평소대로 걷거나 그 우체통을 연다.
 * 입구 안내 말풍선은 그 건물·집 이름표 자리에 뜨고(이름표는 쉰다), 이름표가 없는 우체통·빈 집터는 입구 위에 뜬다.
 */
export function TownGame({
  houses,
  member,
  layers,
  name,
  start,
  startKey,
  mailFlag = false,
  chooseLots = false,
  place = "마을",
  sky = null,
  board = { papers: 3, stamps: 3 },
  tasks,
  season = null,
  celebrate = null,
}: {
  /** 오늘 할 일 (광장 개편 2, A3): 안 끝낸 일의 장소(연못·외양간·내 집) 위에 '!' 쪽지. 없으면 표시도 없다 */
  tasks?: TodayTask[];
  /** 계절 고정 (`?season=`). null이면 지금 한국 시각 (광장 개편 2, A5) */
  season?: Season | null;
  /** 글을 쓰고 돌아왔을 때 내 집에 불이 켜지는 순간 (내 집이 보이는 이웃 마을 수, 광장 개편 2, C2). 같은 날 두 번째부터는 건너뛴다 */
  celebrate?: { villages: number } | null;
  houses: TownHouseInput[];
  member: boolean;
  layers: string[];
  name: string;
  start: Point;
  /** 시작 자리를 고른 주소 값(`?at`). 같으면 다시 만들 때 서 있던 자리를 이어 쓴다 */
  startKey: string;
  /** 안 읽은 알림이 있으면 내 우체통 깃발을 올린다 */
  mailFlag?: boolean;
  /** 내 마을이면 빈 집터에서 이웃 집 자리를 고른다 (TOWN-18) */
  chooseLots?: boolean;
  /** 화면 낭독기 지도 이름 (친구 마을이면 `{닉네임}님의 마을`, TOWN-15) */
  place?: string;
  /** 하늘 고정 (`?sky=night`, 시험·미리보기). null이면 지금 한국 시각 (광장 개편, `skyAt`) */
  sky?: Sky | null;
  /** 살아 있는 게시판: 오늘 새 글 쪽지 수(0~5), 출석 도장 수(0~7). 기본 (3,3)은 예전 그림과 같다 */
  board?: BoardState;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  // 즐겨찾기를 바꿔 집 목록이 다시 오면 게임을 다시 만들되 서 있던 자리는 그대로 (TOWN-12 친구 목록)
  const lastPos = useRef<{ from: string; pos: Point } | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [touch, setTouch] = useState(false);
  const [hintFolded, setHintFolded] = useState(false);
  // 글 쓰고 돌아온 순간의 쪽지 (화면 낭독기에도 읽힌다)
  const [note, setNote] = useState<string | null>(null);
  // 이 화면에서 축하를 시작한 때 (게임을 다시 만들어도 이어 간다)
  const celebrated = useRef<number | null>(null);
  // 이 화면을 연 횟수는 한 번만 센다 (집 목록이 바뀌어 게임을 다시 만들어도)
  const visited = useRef(false);
  const data = JSON.stringify({ houses, member, layers, name, start, startKey, mailFlag, chooseLots, sky, board, tasks: tasks ?? null, season, celebrate });
  // 창 폭이 휴대폰 조건을 넘나들면 게임을 끄고 다시 만든다
  const phone = usePhoneWidth();

  useEffect(() => {
    const canvas = canvasRef.current;
    const promptBox = promptRef.current;
    if (!canvas || phone) return;
    const parsed = JSON.parse(data) as {
      mailFlag: boolean;
      chooseLots: boolean;
      houses: TownHouseInput[];
      member: boolean;
      layers: string[];
      name: string;
      start: Point;
      startKey: string;
      sky: Sky | null;
      board: BoardState;
      tasks: TodayTask[] | null;
      season: Season | null;
      celebrate: { villages: number } | null;
    };
    const { houses, member, layers, name, start, startKey, mailFlag, chooseLots, board, tasks } = parsed;
    const fixedSky = parsed.sky;
    const touchScreen = window.matchMedia("(pointer: coarse)").matches;
    setTouch(touchScreen);
    // 조작 안내: 이 기기에서 마을을 여러 번 열었으면 `?` 팻말로 접는다 (글은 그대로 남아 화면 낭독기·마우스 올리기로 읽는다)
    if (!visited.current) {
      visited.current = true;
      try {
        const visits = Number(localStorage.getItem(HINT_VISITS) ?? "0") + 1;
        localStorage.setItem(HINT_VISITS, String(visits));
        // 저장소(바깥 상태)를 읽은 뒤에 접는다: 첫 그리기는 서버와 같게 펼친 채
        if (visits > HINT_FOLD_AFTER) window.setTimeout(() => setHintFolded(true), 0);
      } catch {
        // 저장소를 못 쓰면 늘 펼친다
      }
    }
    const ctx = canvas.getContext("2d")!;
    const seasonNow = parsed.season ?? seasonAt(new Date());
    const postTask = tasks?.find((t) => t.id === "post");
    const { structures, entrances, walls } = townLayout(houses, member, mailFlag, chooseLots, board, { season: seasonNow, homePosted: postTask?.done });
    const bodies = [...walls, ...structures.flatMap((s) => (s.body ? [s.body] : []))];
    // 클릭 이동 길찾기 (A1): 걸을 수 있는 땅 지도는 한 번만
    const walkGrid = new WalkGrid(bodies);
    const mineHouse = houses.find((h) => h.mine);
    const mineId = mineHouse ? `house:${mineHouse.lot}` : null;
    const mineStructure = mineId ? structures.find((s) => s.id === mineId) : undefined;
    // 친구 마을 (0번 자리가 남의 집): 외양간 돌보기는 내 일이 아니다
    const hostTown = houses.some((h) => h.lot === 0 && !h.mine) && member;

    // 글 쓰고 돌아온 순간 (C2): 오늘 처음이면 내 집 창이 하나씩 켜진다. 내 집이 아직 불 켜진 그림이 아니면 지금 켠다
    const celebrateStart = celebrated.current ?? (parsed.celebrate && mineStructure && firstToday("bv-lit") ? performance.now() : null);
    if (celebrateStart !== null) celebrated.current = celebrateStart;
    canvas.dataset.celebrate = celebrateStart !== null ? "1" : "0";
    const sprites = new Map<object, HTMLCanvasElement>();
    const sprite = (art: PixelArt) => {
      let baked = sprites.get(art);
      if (!baked) {
        baked = bake([art], TOWN_CELL);
        sprites.set(art, baked);
      }
      return baked;
    };
    for (const s of structures) {
      sprite(s.art);
      s.frames?.forEach(sprite);
    }
    // 가로등: 낮에는 끈 유리, 노을·밤·새벽에는 켠 등 (하늘이 바뀌면 그림만 바꾼다)
    const lampLit = lampArt(true);
    const lampDark = lampArt(false);
    const lamps = new Set(structures.filter((s) => s.id.startsWith("lamp:")));
    const lampGlass = bake([glowCells(lampLit, "L", "#fff1b8")], TOWN_CELL);
    const boardStructure = structures.find((s) => s.id === "board");
    // 이름표 자리 (그림 맨 위 빈 줄을 뺀 높이)와 문 (마우스를 올리면 손 모양, 누르면 그 문으로)
    const labeled = structures.filter((s) => s.label);
    const tagLift = new Map(labeled.map((s) => [s, artVisibleHeight(s.art) + 4]));
    const boardDoorIds = new Set<string>(BOARD_DOORS.map((d) => d.id));
    const doors = new Map(structures.map((s) => [s, entrances.filter((e) => e.id === s.id || (s.id === "board" && boardDoorIds.has(e.id)))]));

    // 글 쓰고 돌아온 순간 (C2): 내 집이 아직 불 켜진 그림이 아니면 지금 켠다 (글을 쓴 바로 뒤라 집 목록이 늦을 수 있다)
    if (celebrateStart !== null && mineStructure && !mineStructure.lit) {
      mineStructure.art = withEaveLantern(litHouseArt(mineStructure.art));
      mineStructure.lit = true;
    }
    // 글 쓴 집 (fresh): 불 켜진 창·처마 초롱 덧칠, 창마다 빛 무리와 땅 빛 자국 자리, 굴뚝 연기 자리 (세계 좌표).
    // 축하하는 내 집은 창이 하나씩 켜지는 단계 그림을 미리 굽는다 (`stages`, 마지막 단계가 다 켜진 그림)
    const glassOf = (a: PixelArt) => bake([cellsOnly(a, { G: LIT_GLOW, J: LIT_GLOW })], TOWN_CELL);
    const litHouses = structures
      .filter((s) => s.lit)
      .map((s) => {
        const { width, height } = artSize(s.art);
        const left = s.x - width / 2;
        const top = s.y - height;
        const chimney = chimneyTop(s.art);
        const arts = s === mineStructure && celebrateStart !== null ? celebrateStages(s.art) : [s.art];
        const stages = arts.map((a) => {
          const windows = [...cellGroups(a, "G"), ...cellGroups(a, "J")].map((c) => ({ x: left + c.x * TOWN_CELL, y: top + c.y * TOWN_CELL }));
          return {
            art: a,
            glass: glassOf(a),
            windows,
            // 땅 빛 자국: 1층 창 아래 (집 아랫변 바로 앞)
            spills: cellGroups(a, "G")
              .filter((c) => c.y > a.rows.length * 0.55)
              .map((c) => ({ x: left + c.x * TOWN_CELL, y: s.y + 4 })),
          };
        });
        for (const st of stages) sprite(st.art);
        const lantern = cellGroups(s.art, "J")[0];
        return {
          s,
          left,
          top,
          width,
          height,
          stages,
          smoke: chimney ? { x: left + chimney.x * TOWN_CELL, y: top + chimney.y * TOWN_CELL } : null,
          lantern: lantern ? { x: left + lantern.x * TOWN_CELL, y: top + lantern.y * TOWN_CELL } : null,
        };
      });
    const litOf = new Map(litHouses.map((l) => [l.s, l]));
    // 축하 단계: 처음 쉬고 창이 하나씩 켜진다. 움직임 줄이기면 바로 다 켜진 그림
    const stageOf = (l: (typeof litHouses)[number], now: number) => {
      const n = l.stages.length - 1;
      if (n === 0 || celebrateStart === null || still) return n;
      return Math.max(0, Math.min(n, Math.floor((now - celebrateStart - CELEBRATE.first) / CELEBRATE.gap) + 1));
    };
    const mineLit = mineStructure ? litOf.get(mineStructure) : undefined;
    /** 축하에서 다 켜진 때 (ms, performance.now 기준) */
    const celebrateLitAt = celebrateStart !== null && mineLit ? celebrateStart + CELEBRATE.first + (mineLit.stages.length - 2) * CELEBRATE.gap : null;
    // 밤 지붕 (A4): 덧칠 뒤에 집 지붕 칸을 원래 지붕색을 어둡게(0.35) 한 색으로 다시 칠해 빨강·파랑 지붕이 회보라로 뭉개지지 않게
    const roofs = structures
      .filter((s) => s.id.startsWith("house:") && !s.alpha && s.art.palette.R)
      .map((s) => {
        const { width, height } = artSize(s.art);
        return { s, left: s.x - width / 2, top: s.y - height, width, height, img: bake([cellsOnly(s.art, { R: darken(s.art.palette.R, 0.35), r: darken(s.art.palette.r ?? s.art.palette.R, 0.35) })], TOWN_CELL) };
      });
    const smokeSprites = Array.from({ length: SMOKE_FRAMES }, (_, f) => bake([smokeArt(f)], TOWN_CELL));
    const lampGlow = bakeGlow(64, 64, WARM, [0.34, 0.2, 0.09]);
    const poolGlow = bakeGlow(60, 22, WARM, [0.26, 0.12]);
    const windowGlow = bakeGlow(36, 30, WARM, [0.5, 0.26, 0.1]);
    const lanternGlow = bakeGlow(64, 64, LANTERN_LIGHT, [0.35, 0.16, 0.06]);
    // 켜진 창 아래 땅 빛 자국 (30×18 사다리꼴, #ffd56e 0.22): 4px 칸으로 끊어 아래로 넓어진다
    const spillGlow = (() => {
      const c = document.createElement("canvas");
      c.width = 30;
      c.height = 18;
      const g = c.getContext("2d")!;
      g.fillStyle = "rgba(255, 213, 110, 0.22)";
      for (let y = 0; y < 18; y += 3) {
        const half = 8 + Math.round((y / 18) * 7);
        g.fillRect(15 - half, y, half * 2, 3);
      }
      return c;
    })();
    const glowAt = (glow: HTMLCanvasElement, x: number, y: number, vw: number, vh: number) => {
      const w = glow.width * GROUND_CELL;
      const h = glow.height * GROUND_CELL;
      const left = Math.round(x - w / 2);
      const top = Math.round(y - h / 2);
      if (left > vw || top > vh || left + w < 0 || top + h < 0) return;
      ctx.drawImage(glow, left, top, w, h);
    };

    // 시험 훅: 불 켜진 집 자리, 게시판 쪽지·도장, 내 우체통 깃발 (깃발은 `bv-mail`로 바뀌어도 React가 되돌리지 않게 여기서만 쓴다)
    const lots = (list: readonly TownHouseInput[]) =>
      list
        .map((h) => h.lot)
        .sort((a, b) => a - b)
        .join(" ");
    canvas.dataset.lit = lots(houses.filter((h) => h.fresh && !h.suggested));
    canvas.dataset.board = `${board.papers},${board.stamps}`;
    // 광장 개편 2 시험 훅: 계절, 이사 올 집 자리, 이웃 우체통 깃발(안 읽은 새 글), 줄등 초롱(`자리:켜짐`)
    canvas.dataset.season = seasonNow;
    canvas.dataset.suggested = lots(houses.filter((h) => h.suggested));
    canvas.dataset.flags = lots(houses.filter((h) => !h.mine && !h.suggested && hasNews(h)));
    let mailFlagNow = mailFlag;
    canvas.dataset.mailFlag = mailFlag ? "1" : "0";
    const myMailbox = mineHouse ? structures.find((s) => s.id === `mailbox:${mineHouse.lot}`) : undefined;
    const snowy = (a: PixelArt) => (seasonNow === "winter" ? snowCap(a) : a);

    // 청사초롱 줄등 (A4): 가로등 네 꼭대기에서 장대까지 줄 네 가닥, 즐겨찾는 이웃 한 명에 초롱 하나. 장대 꼭대기는 0번 자리 주인의 초롱
    const slots = lanternSlots(houses);
    canvas.dataset.lanterns = slots.map((l) => `${l.lot}:${l.lit ? 1 : 0}`).join(" ");
    const hooks = lanternPlacements(slots.length);
    const lanternSprites = {
      m: [bake([lanternArt(false, "m")], TOWN_CELL), bake([lanternArt(true, "m")], TOWN_CELL)],
      l: [bake([lanternArt(false, "l")], TOWN_CELL), bake([lanternArt(true, "l")], TOWN_CELL)],
    };
    const owner = houses.find((h) => h.lot === 0 && !h.suggested);
    const homeLit = owner ? (owner.mine ? (postTask?.done ?? owner.fresh === true) : owner.fresh === true) : false;
    const top = mastTop();
    const lanterns = [
      ...slots.map((slot, i) => ({ size: "m" as const, lit: slot.lit, brightness: slot.brightness, hook: hooks[i].hook, phase: i % 2 })),
      ...(owner ? [{ size: "l" as const, lit: homeLit, brightness: 1, hook: top, phase: -1 }] : []),
    ];
    // 줄 네 가닥은 한 번 굽는다 (2px 먹색, 가운데가 처진다)
    const ropes = lanternRopes();
    const ropeBox = {
      left: Math.floor(Math.min(...ropes.flatMap((r) => [r.from.x, r.to.x]))) - 4,
      top: Math.floor(Math.min(...ropes.flatMap((r) => [r.from.y, r.to.y]))) - 4,
      right: Math.ceil(Math.max(...ropes.flatMap((r) => [r.from.x, r.to.x]))) + 4,
      bottom: Math.ceil(Math.max(...ropes.flatMap((r) => [r.from.y, r.to.y]))) + 30,
    };
    const ropeLayer = document.createElement("canvas");
    ropeLayer.width = ropeBox.right - ropeBox.left;
    ropeLayer.height = ropeBox.bottom - ropeBox.top;
    {
      const g = ropeLayer.getContext("2d")!;
      g.fillStyle = LANTERN.ink;
      for (const r of ropes) {
        const n = Math.ceil(Math.abs(r.to.x - r.from.x) * 2);
        for (let i = 0; i <= n; i++) {
          const p = ropePoint(r, i / n);
          g.fillRect(Math.round(p.x) - ropeBox.left - 1, Math.round(p.y) - ropeBox.top - 1, 2, 2);
        }
      }
    }
    const lanternBox = (l: (typeof lanterns)[number], swayOn: boolean) => {
      const img = lanternSprites[l.size][0];
      // 두 장으로 한 칸 흔들린다 (이웃한 초롱은 엇갈려서)
      const sway = swayOn && l.phase >= 0 ? ((Math.floor(performance.now() / SWAY_MS) + l.phase) % 2) * TOWN_CELL : 0;
      // 장대 꼭대기 초롱은 꼭지 위에 얹고, 줄 초롱은 줄 점에서 한 칸 아래로 매단다
      const y = l.size === "l" ? l.hook.y - img.height + TOWN_CELL : l.hook.y + 2;
      return { x: Math.round(l.hook.x - img.width / 2 + sway), y: Math.round(y), width: img.width, height: img.height };
    };

    // 오늘 할 일 '!' 쪽지 (A3): 안 끝낸 일의 장소 위. 낚시는 연못, 돌보기는 외양간(내 마을만, 돌볼 동물이 있을 때: `nudge`), 공개 글은 내 집
    const markerSprites = [bake([markerArt()], TOWN_CELL)];
    const taskEntrance = (id: string) => entrances.find((e) => e.id === id);
    const markers = (tasks ?? [])
      .filter((t) => !t.done && t.nudge !== false)
      .flatMap((t) => {
        const spot = t.id === "fishing" ? "pond" : t.id === "farm" && !hostTown ? "farm" : t.id === "post" && mineStructure ? "home" : null;
        if (!spot) return [];
        const s = spot === "home" ? mineStructure : structures.find((x) => x.id === spot);
        if (!s) return [];
        const { width } = artSize(s.art);
        const front = spot === "home" ? lotFront(mineHouse!.lot) : null;
        const e: TownEntrance | undefined = spot === "home" ? { id: "marker:home", x: front!.x, y: front!.y, label: "✏️ 공개 글 쓰기", href: "/write" } : taskEntrance(spot);
        if (!e) return [];
        const x = spot === "home" ? s.x - 52 : s.x + width / 2 - 30;
        const y = s.y - artVisibleHeight(s.art) + (spot === "home" ? 14 : -4);
        return [{ spot, x, y, entrance: e }];
      })
      .sort((a, b) => ["pond", "farm", "home"].indexOf(a.spot) - ["pond", "farm", "home"].indexOf(b.spot));
    canvas.dataset.markers = markers.map((m) => m.spot).join(" ");
    const markerBox = (m: (typeof markers)[number], bob: number) => {
      const img = markerSprites[0];
      return { x: Math.round(m.x - img.width / 2), y: Math.round(m.y - img.height - bob), width: img.width, height: img.height };
    };
    // 불꽃 (넷을 다 한 날 처음, 글 쓰고 돌아온 순간): 그 자리와 시작 때
    const sparkSprites = Array.from({ length: SPARK_FRAMES }, (_, f) => bake([sparkArt(f)], TOWN_CELL));
    const sparks: { x: number; y: number; at: number }[] = [];
    const four = (tasks ?? []).filter((t) => ["attendance", "post", "fishing", "farm"].includes(t.id));
    if (four.length === 4 && four.every((t) => t.done) && mineStructure && firstToday("bv-done")) {
      const l = litOf.get(mineStructure);
      const at = l?.lantern ?? { x: mineStructure.x, y: mineStructure.y - artVisibleHeight(mineStructure.art) };
      sparks.push({ x: at.x, y: at.y, at: performance.now() + 600 });
    }
    if (celebrateLitAt !== null && mineLit?.lantern) sparks.push({ x: mineLit.lantern.x, y: mineLit.lantern.y, at: celebrateLitAt + CELEBRATE.gap });
    const celebrateNote = parsed.celebrate
      ? parsed.celebrate.villages > 0
        ? `🏮 내 초롱이 켜졌어요 · 이웃 ${parsed.celebrate.villages}명의 마을에서 내 집이 빛나요`
        : "🏮 내 초롱이 켜졌어요 · 이웃이 ⭐하면 그 마을에 내 집이 서요"
      : null;
    let noteShown = false;

    // 우체통 쪽지 (B3 `bv-note {lot}`): 그 우체통 깃발을 0.8초 들었다 내린다
    const noteTimers = new Set<number>();
    const onNote = (event: Event) => {
      const lot = (event as CustomEvent<{ lot: number }>).detail?.lot;
      const box = structures.find((x) => x.id === `mailbox:${lot}`);
      const house = houses.find((h) => h.lot === lot);
      if (!box || !house || house.suggested) return;
      const mine = house.mine;
      box.art = snowy(mailboxArt(mine, true));
      const timer = window.setTimeout(() => {
        noteTimers.delete(timer);
        box.art = snowy(mailboxArt(mine, mine ? mailFlagNow : hasNews(house)));
      }, 800);
      noteTimers.add(timer);
    };
    window.addEventListener("bv-note", onNote);

    // 하늘 (한국 시각): 고정하지 않았으면 다음 바뀌는 때에 다시 본다
    let currentSky: Sky = fixedSky ?? skyAt();
    let lampOn = false;
    let strength = 0;
    let tint = SKY_TINT.day;
    let band: HTMLCanvasElement | null = null;
    let stars: HTMLCanvasElement | null = null;
    const bands = new Map<Sky, HTMLCanvasElement>();
    const applySky = () => {
      canvas.dataset.sky = currentSky;
      lampOn = lampsOn(currentSky);
      strength = LIGHT[currentSky];
      tint = SKY_TINT[currentSky];
      if (currentSky === "day") band = null;
      else {
        band = bands.get(currentSky) ?? bakeSkyBand(currentSky);
        bands.set(currentSky, band);
      }
      if (currentSky === "night" && !stars) stars = bakeStars();
    };
    applySky();
    // 다음 하늘로 바뀌는 벽시계 시각. 프레임마다 견준다: 긴 타이머는 컴퓨터가 잠들거나 탭이 쉬면 늦게 와서 하늘이 멈춰 있을 수 있다
    let skyDue = fixedSky ? Infinity : Date.now() + msUntilNextSky();
    // 움직임 줄이기: 물·연기는 첫 그림에 멈춘다
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let still = motion.matches;
    const onMotion = (event: MediaQueryListEvent) => {
      still = event.matches;
    };
    motion.addEventListener("change", onMotion);

    // 이름표 글씨 (갈무리 12px): 글꼴을 다 받으면 구운 것을 비우고 다시 굽는다
    const css = getComputedStyle(document.documentElement);
    const tags = new TagCache({
      pixel: css.getPropertyValue("--font-pixel").trim() || '"Galmuri11", sans-serif',
      sans: getComputedStyle(document.body).fontFamily || "system-ui, sans-serif",
    });
    let disposed = false;
    document.fonts
      ?.load(PIXEL_FONT_PROBE)
      .then(() => {
        if (!disposed) tags.clear();
      })
      .catch(() => {});

    // 걷는 그림 (TOWN-17): 방향마다 서 있기 + 걷기 4칸
    const bakeSheet = (keys: readonly string[], given?: PixelArt) => {
      const arts = given ? [given] : keys.map(findArt).filter((a): a is PixelArt => a !== undefined);
      const sheet = new Map<string, HTMLCanvasElement>();
      if (arts.length > 0) {
        for (const d of WALK_DIRS) for (let f = 0; f <= WALK_FRAMES; f++) sheet.set(`${d}:${f}`, bakeGrid(walkFrame(arts, d, f), PLAYER_SIZE / 16));
      }
      return sheet;
    };
    const walkSheet = bakeSheet(layers);

    // 걸어 다니는 이웃 (TOWN-19): 집이 선 이웃(1~10번)이 흙길을 걷는다. 내 집(0번) 앞에는 오지 않는다
    const graph = npcGraph(bodies, lotFront(0), HOUSE_LOTS.map((_, i) => lotFront(i)));
    // 이사 올 이웃(흐린 집)은 걷지 않는다 (A6)
    const walkers = houses.filter((h) => h.lot > 0 && !h.suggested);
    const npcs = createNpcs(graph, walkers, Math.random);
    const npcSheets = new Map<number, Map<string, HTMLCanvasElement>>();
    // 입은 것이 없는 이웃은 블로그 주소로 고른 머리·윗옷 색 (A2)
    for (const h of walkers) npcSheets.set(h.lot, h.layers && h.layers.length > 0 ? bakeSheet(h.layers) : bakeSheet([], neighborArt(h.slug)));
    const npcNames = new Map(houses.map((h) => [h.lot, shortName(h.nickname)]));
    // 안 읽은 새 글이 있는 이웃의 말풍선 (`✎ 제목 · 2시간 전`)과 누르면 갈 글 (A2, B4)
    const bubbleNow = new Date();
    const titles = new Map(
      walkers
        .filter((h) => hasNews(h) && (h.recentPosts?.[0]?.title ?? h.latestTitle))
        .map((h) => {
          const latest = h.recentPosts?.[0];
          const title = latest?.title ?? h.latestTitle!;
          return [h.lot, { title, text: bubbleWithAge(title, latest?.createdAt, bubbleNow), href: latest ? `/@${h.slug}/${latest.id}` : `/@${h.slug}`, door: lotFront(h.lot) }];
        }),
    );
    // 지금 그린 말풍선 자리 (화면 좌표): 누르면 그 글로
    let bubbleHit: { lot: number; href: string; x: number; y: number; width: number; height: number } | null = null;
    const npcTime = new Map<number, number>();
    canvas.dataset.npcs = String(npcs.length);
    // 마우스가 올라간 곳 (이웃 이름표·집 문패)
    let hover: Point | null = null;
    let hoverStructure: Structure | null = null;
    const npcAt = (p: Point): Npc | undefined =>
      npcs.find((n) => Math.abs(p.x - n.pos.x) <= 22 && p.y >= n.pos.y - PLAYER_SIZE + 8 && p.y <= n.pos.y + 4);
    // 이름표 자리 (그림 위 빈 칸에 걸린다). 이름표를 눌러도 그 건물·집이다
    const tagStyle = (s: Structure) => ((s.tag ?? "sign") === "sign" ? "sign" : s.id === mineId ? "mine" : "plate");
    const inTag = (p: Point, text: string, style: "sign" | "mine" | "plate", x: number, bottom: number) => {
      const size = tags.size(text, style);
      return Math.abs(p.x - x) <= size.width / 2 && p.y <= bottom && p.y >= bottom - size.height;
    };
    const tagAt = (p: Point): Structure | undefined => labeled.find((s) => inTag(p, s.label!, tagStyle(s), s.x, s.y - tagLift.get(s)!));
    // 게시판 아래 세 팻말 (`소식`·`글감`·`출석`)은 판 그림 밖 다리 사이에 매달려 있다. 가운데 글감은 종이 쪽지
    const plankStyle = (id: string) => (id === "prompt" ? "plate" : "sign");
    const onBoardPlank = (p: Point) => BOARD_DOORS.some((d) => inTag(p, d.plank, plankStyle(d.id), BOARD_POS.x + d.dx, BOARD_POS.y - BOARD_PLANK_LIFT));
    // 그림의 칠한 칸만 (집 양옆 풀밭을 눌렀으면 집이 아니라 그 풀밭으로 걷는다), 그리고 이름표·팻말
    const structureAt = (p: Point): Structure | undefined =>
      structureAtPoint(structures, p) ?? tagAt(p) ?? (boardStructure && onBoardPlank(p) ? boardStructure : undefined);
    // 입구마다 안내 말풍선을 띄울 이름표 자리 (건물·집). 없으면 입구 위
    const promptOwner = new Map(entrances.map((e) => [e, entranceOwner(e, structures)]));
    const ground = bakeGround(seasonNow);
    // 세계 밖 (넓은 화면에서 서랍을 비켜 카메라가 동쪽 끝을 넘을 때): 빽빽한 숲으로 채운다
    const edgeForest = (() => {
      const c = document.createElement("canvas");
      c.width = EDGE_FOREST;
      c.height = WORLD.height;
      const g = c.getContext("2d")!;
      g.fillStyle = "#2a7348";
      g.fillRect(0, 0, c.width, c.height);
      const trees = [0, 1, 2, 3].map((v) => bake([treeArt(v, seasonNow)], TOWN_CELL));
      let row = 0;
      for (let y = 0; y < WORLD.height + 80; y += 45, row++) {
        for (let x = (row % 2) * 30 - 10; x < c.width + 40; x += 60) {
          const t = trees[(row * 3 + Math.round(x / 60)) % trees.length];
          g.drawImage(t, x - t.width / 2, y - t.height);
        }
      }
      return c;
    })();

    // 시작 자리(?at)가 바뀌었으면 새 자리에서. 환영(?welcome)을 주소에서 지운 뒤 다시 그려도 자리는 그대로
    const from = startKey;
    let pos: Point = lastPos.current?.from === from ? lastPos.current.pos : { ...start };
    let target: Point | null = null;
    // 클릭 이동 길 (A1): 꺾이는 점 목록 (`target`은 그 맨 앞), 끝 점, 막혀서 다시 찾은 횟수, 땅에 보이는 길과 그린 때
    let route: Point[] = [];
    let routeGoal: Point | null = null;
    let replans = 0;
    let routeShown: { from: Point; points: Point[]; goal: Point; at: number } | null = null;
    // 멀리 있는 건물을 눌렀으면 그 문 앞에 닿는 순간 들어간다
    let pending: TownEntrance | null = null;
    let enterNext = false;
    let facing: WalkDir = "down";
    let walking = false;
    let walkTime = 0;
    let shown: string | null = null;
    // 지금 안내 말풍선이 가리키는 입구 (말풍선을 누르면 그리로 들어간다)
    let promptNear: TownEntrance | null = null;
    let stuck = 0;
    let zone: Zone | null = null;
    const held = new Set<string>();
    const camera = { x: 0, y: 0 };

    const go = (e: TownEntrance) => {
      const lot = mailboxLot(e.href);
      const choice = lotChoice(e.href);
      if (lot !== null) window.dispatchEvent(new CustomEvent("bv-mailbox", { detail: { lot } }));
      else if (choice !== null) window.dispatchEvent(new CustomEvent("bv-lots", { detail: { lot: choice } }));
      else router.push(e.href === "login" ? "/" : e.href);
    };

    // 화면 배율(devicePixelRatio)만큼 캔버스를 키워 고해상도 화면에서도 또렷하게. 그리는 좌표는 CSS px
    let dpr = 1;
    // 입구 안내 말풍선 윗변의 하한: 화면 위 간판 묶음(`data-town-hud-row`) 아래. 친구 마을의 좁은 화면은 장소 간판이 둘째 줄이라 더 아래
    let promptTop = PROMPT_TOP;
    // 화면 위 간판 묶음·광장 소식 서랍이 덮는 자리 (캔버스 안 좌표). 이름표가 반쯤 가려 삐져나오지 않게, 겹치는 이름표는 쉰다
    let hudRects: { left: number; top: number; right: number; bottom: number }[] = [];
    // 펼친 광장 소식 서랍이 덮는 오른쪽 폭 (A2): 카메라 가운데를 그만큼 왼쪽으로 옮긴다 (접힌 탭은 치지 않는다)
    let drawerCover = 0;
    // 열린 창(☰·우체통·자리 고르기, 왼쪽 위)이 덮는 왼쪽 폭 (D4): 카메라 가운데를 그만큼 오른쪽으로, 창이 열린 동안 입구 안내는 쉰다
    let panelCover = 0;
    let panelOpen = false;
    const measureHud = () => {
      const c = canvas.getBoundingClientRect();
      promptTop = PROMPT_TOP;
      hudRects = [];
      drawerCover = 0;
      panelCover = 0;
      const panelEl = document.querySelector<HTMLElement>("[data-town-panel]");
      panelOpen = panelEl !== null;
      if (panelEl) {
        const r = panelEl.getBoundingClientRect();
        if (r.width > 0 && r.width < c.width / 2) panelCover = Math.max(0, Math.round(r.right - c.left + 12));
      }
      for (const el of document.querySelectorAll<HTMLElement>("[data-town-hud-row], [data-town-drawer]")) {
        const r = el.getBoundingClientRect();
        if (r.height === 0) continue;
        hudRects.push({ left: r.left - c.left, top: r.top - c.top, right: r.right - c.left, bottom: r.bottom - c.top });
        if (el.hasAttribute("data-town-hud-row")) promptTop = Math.max(promptTop, Math.round(r.bottom - c.top) + 12);
        else if (r.width > 200 && r.height > 160) drawerCover = Math.max(drawerCover, Math.round(c.right - r.left + 12));
      }
    };
    const underHud = (x: number, bottom: number, size: { width: number; height: number }) =>
      hudRects.some((r) => x + size.width / 2 > r.left && x - size.width / 2 < r.right && bottom > r.top && bottom - size.height < r.bottom);
    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      tags.setScale(dpr);
      measureHud();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    // 서랍을 펴고 접거나 지갑 숫자가 바뀌어 간판 크기가 달라지면 다시 잰다
    const hudObserver = new ResizeObserver(measureHud);
    for (const el of document.querySelectorAll<HTMLElement>("[data-town-hud-row], [data-town-drawer]")) hudObserver.observe(el);
    // 입구 안내 말풍선 폭 (화면 가장자리에서 잘리지 않게)
    let promptHalf = 0;
    let promptHeight = 0;
    let promptX = Number.NaN;
    let promptY = Number.NaN;
    const promptObserver = new ResizeObserver(() => {
      promptHalf = (promptBox?.offsetWidth ?? 0) / 2;
      // 말풍선 높이 (아래 꼬리 자리 pb-[10px] 포함)
      promptHeight = promptBox?.offsetHeight ?? 0;
      promptX = Number.NaN;
    });
    if (promptBox) promptObserver.observe(promptBox);

    /** 클릭한 곳까지 걷는 길을 찾는다 (A1): 길이 없으면 그쪽으로 곧게 가다 막히면 멈춘다 */
    const walkTo = (goal: Point, now = performance.now()) => {
      const path = walkGrid.find(pos, goal);
      routeGoal = goal;
      replans = 0;
      route = path ?? [goal];
      target = route[0] ?? null;
      const end = route.at(-1) ?? goal;
      routeShown = { from: { ...pos }, points: [...route], goal: end, at: now };
    };
    const stopRoute = () => {
      route = [];
      routeGoal = null;
      target = null;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      // 게임이 보이지 않으면(휴대폰 폭으로 줄인 사이) 키를 가져가지 않는다
      if (canvas.clientWidth === 0 || yieldsKey(event)) return;
      if (MOVE_KEYS[event.code]) {
        held.add(event.code);
        stopRoute();
        pending = null;
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
      pending = null;
      // 떠 있는 입구 안내 말풍선을 누르면 들어간다 (말풍선은 누르기를 막지 않아 캔버스가 받는다)
      if (promptNear && Number.isFinite(promptX)) {
        const sx = p.x - camera.x;
        const sy = p.y - camera.y;
        if (Math.abs(sx - promptX) <= promptHalf && sy <= promptY && sy >= promptY - promptHeight) return go(promptNear);
      }
      // 이웃 새 글 말풍선을 누르면 그 글 (A2)
      if (bubbleHit) {
        const sx = p.x - camera.x;
        const sy = p.y - camera.y;
        if (sx >= bubbleHit.x && sx <= bubbleHit.x + bubbleHit.width && sy >= bubbleHit.y && sy <= bubbleHit.y + bubbleHit.height) {
          router.push(bubbleHit.href);
          return;
        }
      }
      // 오늘 할 일 '!' 쪽지를 누르면 그 할 일 자리로 걸어가 들어간다 (A3)
      const marker = markerAt(p);
      if (marker) return approach(marker.entrance);
      // 줄등 초롱을 누르면 그 초롱 아래로 걸어가 글을 연다 (A4)
      const lantern = lanternAt(p);
      if (lantern) return approach(lantern);
      // 걷는 이웃을 누르면 그 집 우체통 (TOWN-19)
      const npc = npcAt(p);
      if (npc) {
        fromNpc(npc.lot);
        return;
      }
      // 건물·집을 눌렀으면 그 입구로 (가까우면 바로 들어가고, 멀면 길을 찾아 걸어가서 닿으면 들어간다)
      const hit = structureAt(p);
      const door = hit && doors.get(hit);
      if (hit && door && door.length > 0) {
        // 문이 여럿이면(게시판) 누른 자리에서 가장 가까운 문
        const e = door.reduce((a, b) => (Math.abs(b.x - p.x) < Math.abs(a.x - p.x) ? b : a));
        approach(e);
      } else {
        walkTo(p);
      }
    };
    /** 입구로: 가까우면 바로 들어가고, 멀면 걸어가서 닿으면 들어간다 */
    const approach = (e: TownEntrance) => {
      if (entranceDistance(pos, e) <= INTERACT_DISTANCE) return go(e);
      walkTo({ x: e.x, y: e.y });
      pending = e;
    };
    /** 그 점에 그린 '!' 쪽지 */
    const markerAt = (p: Point) =>
      markers.find((m) => {
        const b = markerBox(m, 0);
        return p.x >= b.x - 4 && p.x <= b.x + b.width + 4 && p.y >= b.y - 8 && p.y <= b.y + b.height + 4;
      });
    /** 그 점에 그린 켜진 초롱의 입구 (줄 초롱과 장대 꼭대기 초롱) */
    const lanternAt = (p: Point): TownEntrance | undefined => {
      for (let i = 0; i < lanterns.length; i++) {
        const l = lanterns[i];
        const b = lanternBox(l, false);
        if (p.x < b.x - 4 || p.x > b.x + b.width + 4 || p.y < b.y - 4 || p.y > b.y + b.height + 4) continue;
        const id = l.size === "l" ? "lantern:home" : `lantern:${slots[i].lot}`;
        const e = entrances.find((x) => x.id === id);
        if (e) return e;
      }
      return undefined;
    };
    const fromNpc = (lot: number) => window.dispatchEvent(new CustomEvent("bv-mailbox", { detail: { lot } }));
    const onHover = (event: PointerEvent) => {
      hover = toWorld(event);
      const npc = npcAt(hover);
      hoverStructure = npc ? null : (structureAt(hover) ?? null);
      const sx = hover.x - camera.x;
      const sy = hover.y - camera.y;
      const onBubble = bubbleHit !== null && sx >= bubbleHit.x && sx <= bubbleHit.x + bubbleHit.width && sy >= bubbleHit.y && sy <= bubbleHit.y + bubbleHit.height;
      canvas.style.cursor = onBubble || markerAt(hover) || lanternAt(hover) || npc || (hoverStructure && (doors.get(hoverStructure)?.length ?? 0) > 0) ? "pointer" : "";
    };
    const onLeave = () => {
      hover = null;
      hoverStructure = null;
    };
    const onTeleport = (event: Event) => {
      const { x, y } = (event as CustomEvent<Point>).detail;
      pos = { x, y };
      stopRoute();
      routeShown = null;
      pending = null;
    };
    const offMail = onTown("bv-mail", ({ flag }) => {
      if (flag === mailFlagNow) return;
      mailFlagNow = flag;
      canvas.dataset.mailFlag = flag ? "1" : "0";
      // 내 우체통 그림만 다시 굽는다 (게임은 그대로)
      if (myMailbox) myMailbox.art = snowy(mailboxArt(true, flag));
    });
    const offEnter = onTown("bv-enter", () => {
      enterNext = true;
    });
    // 걸어가는 사이에 창(☰·지갑·우체통)을 열면 문 앞에 닿아도 들어가지 않는다 (걷기는 그대로)
    const offPanel = onTown("bv-panel", ({ open }) => {
      if (open) pending = null;
      panelOpen = open;
      // 창이 그려진 뒤에 그 폭을 잰다
      requestAnimationFrame(() => {
        if (!disposed) measureHud();
      });
    });
    // 헤더 🏘 마을 링크에 포커스가 남아 있으면 Space·Enter가 그 링크로 가므로 놓아 준다
    if (document.activeElement instanceof HTMLElement && !document.activeElement.closest("[data-town]")) document.activeElement.blur();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    canvas.addEventListener("pointerdown", onPointer);
    canvas.addEventListener("pointermove", onHover);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("bv-teleport", onTeleport);

    // 그릴 것 (아랫변 y 순서). 프레임마다 새로 만들지 않고 돌려 쓴다
    type Item = { y: number; s: Structure | null; n: Npc | null };
    const pool: Item[] = [];
    const items: Item[] = [];
    let used = 0;
    const put = (y: number, s: Structure | null, n: Npc | null) => {
      let item = pool[used];
      if (item) {
        item.y = y;
        item.s = s;
        item.n = n;
      } else {
        item = { y, s, n };
        pool[used] = item;
      }
      used++;
      items.push(item);
    };
    const byY = (a: Item, b: Item) => a.y - b.y;

    let anim = 0;
    let frameNow = performance.now();
    const artOf = (s: Structure): PixelArt => {
      if (lamps.has(s)) return lampOn ? lampLit : lampDark;
      if (s.frames) return s.frames[still ? 0 : anim % s.frames.length];
      const l = s.lit ? litOf.get(s) : undefined;
      if (l && l.stages.length > 1) return l.stages[stageOf(l, frameNow)].art;
      return s.art;
    };
    const drawStructure = (s: Structure) => {
      const art = artOf(s);
      const { width, height } = artSize(art);
      const left = s.x - width / 2 - camera.x;
      const top = s.y - height - camera.y;
      if (s.alpha !== undefined) ctx.globalAlpha = s.alpha;
      if (s.id !== "mast") {
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.beginPath();
        ctx.ellipse(left + width / 2, top + height - 2, width * 0.42, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.drawImage(sprite(art), Math.round(left), Math.round(top));
      ctx.globalAlpha = 1;
      // 글 쓴 집의 굴뚝 연기 (아랫변 가운데 = 굴뚝 꼭대기 바로 위). 축하하는 집은 창이 다 켜진 뒤에
      const lit = s.lit ? litOf.get(s) : undefined;
      const smoke = lit && stageOf(lit, frameNow) === lit.stages.length - 1 ? lit.smoke : null;
      if (smoke) {
        const puff = smokeSprites[still ? 0 : anim % SMOKE_FRAMES];
        ctx.globalAlpha = 0.92;
        ctx.drawImage(puff, Math.round(smoke.x - 3.5 * TOWN_CELL - camera.x), Math.round(smoke.y - 11 * TOWN_CELL - camera.y));
        ctx.globalAlpha = 1;
      }
      // 게시판 세 입구 위 팻말 (판 아래에 매달려 있어 앞에 선 캐릭터에 가린다). 가운데 글감은 종이 쪽지
      if (s === boardStructure) {
        for (const d of BOARD_DOORS) tags.draw(ctx, d.plank, plankStyle(d.id), BOARD_POS.x + d.dx - camera.x, BOARD_POS.y - BOARD_PLANK_LIFT - camera.y);
      }
    };
    let walkStep = 0;
    const drawPlayer = () => {
      const px = Math.round(pos.x - camera.x);
      const py = Math.round(pos.y - camera.y);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.ellipse(px, py, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      const look = walkSheet.get(`${facing}:${walkStep}`);
      if (look) ctx.drawImage(look, px - PLAYER_SIZE / 2, py - PLAYER_SIZE + 4);
    };
    const drawNpc = (n: Npc) => {
      const nx = Math.round(n.pos.x - camera.x);
      const ny = Math.round(n.pos.y - camera.y);
      const frameNo = n.walking ? 1 + (Math.floor((npcTime.get(n.lot) ?? 0) * WALK_FPS) % WALK_FRAMES) : 0;
      const look = npcSheets.get(n.lot)?.get(`${n.facing}:${frameNo}`);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.ellipse(nx, ny, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      if (look) ctx.drawImage(look, nx - PLAYER_SIZE / 2, ny - PLAYER_SIZE + 4);
    };
    /** 캐릭터(발밑 x, y)가 화면 상자 [x, y, w, h]를 가리는가: 몸통 폭 36·키 60 */
    const covers = (cx: number, cy: number, x: number, y: number, w: number, h: number) => cx + 18 > x && cx - 18 < x + w && cy > y && cy - 60 < y + h;

    let last = performance.now();
    let frame = 0;
    let compact = false;
    // 노을 빛 띠 (A5): 화면 높이가 바뀌면 다시 굽는다
    const bakeDuskBand = (vh: number) => {
      const c = document.createElement("canvas");
      c.width = 1;
      c.height = Math.max(1, Math.round(vh * DUSK_GLOW.height));
      const g = c.getContext("2d")!;
      const grad = g.createLinearGradient(0, 0, 0, c.height);
      const [r, gg, b] = [1, 3, 5].map((i) => parseInt(DUSK_GLOW.color.slice(i, i + 2), 16));
      grad.addColorStop(0, `rgba(${r}, ${gg}, ${b}, ${DUSK_GLOW.alpha})`);
      grad.addColorStop(1, `rgba(${r}, ${gg}, ${b}, 0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, 1, c.height);
      return c;
    };
    let duskBand: HTMLCanvasElement | null = bakeDuskBand(canvas.clientHeight || 800);
    /** `dt`초만큼 걷는다 (한 걸음은 `MAX_STEP_SECONDS` 이하라 몸체를 뚫고 지나가지 않는다). 키보드가 클릭 목표보다 먼저 */
    const walkFor = (dt: number) => {
      let dx = 0;
      let dy = 0;
      for (const code of held) {
        dx += MOVE_KEYS[code].x;
        dy += MOVE_KEYS[code].y;
      }
      if (dx === 0 && dy === 0 && target) {
        // 길의 다음 점에 닿으면 그다음 점으로 (A1)
        while (target && Math.hypot(target.x - pos.x, target.y - pos.y) < 4) {
          route.shift();
          target = route[0] ?? null;
        }
        if (!target) routeGoal = null;
        else {
          dx = target.x - pos.x;
          dy = target.y - pos.y;
        }
      }
      const dir = normalize(dx, dy);
      if (dir.x === 0 && dir.y === 0) {
        walking = false;
        walkTime = 0;
        return;
      }
      // 계단에서는 조금 느리게 (TOWN-05). 목표를 지나치지 않게 남은 거리까지만
      const speed = onStairs(pos) ? SPEED * STAIR_SLOW : SPEED;
      const reach = held.size === 0 && target ? Math.min(speed * dt, Math.hypot(target.x - pos.x, target.y - pos.y)) : speed * dt;
      // 키보드는 몸체 모서리에서 옆으로 미끄러진다 (A1: ↑를 누르고 있으면 분수를 돌아간다)
      const next = slideStep(pos, { x: dir.x * reach, y: dir.y * reach }, bodies);
      // 길을 따라가다 막히면 지금 자리에서 길을 다시 찾고(두 번까지), 그래도 막히면 멈춘다
      stuck = Math.hypot(next.x - pos.x, next.y - pos.y) < 0.5 ? stuck + dt : 0;
      if (stuck > 0.25 && held.size === 0 && target) {
        stuck = 0;
        const goal = routeGoal;
        const path = goal && replans < 2 ? walkGrid.find(next, goal) : null;
        if (path && path.length > 0) {
          replans++;
          route = path;
          target = route[0];
        } else stopRoute();
      }
      facing = walkDir(dir.x, dir.y, facing);
      // 벽에 막혀 제자리면 걷지 않는다
      walking = Math.hypot(next.x - pos.x, next.y - pos.y) > 0.01;
      pos = next;
      if (walking) walkTime += dt;
    };
    const tick = (now: number) => {
      const frameSeconds = (now - last) / 1000;
      last = now;
      anim = Math.floor(now / ANIM_MS);
      frameNow = now;
      // 하늘이 바뀔 때가 지났으면 바꾼다 (잠들었다 깨어나거나 탭으로 돌아온 첫 프레임에도)
      if (Date.now() >= skyDue) {
        currentSky = skyAt();
        applySky();
        skyDue = Date.now() + msUntilNextSky();
      }

      // 움직이기: 지난 시간을 잘게 나눠 걷는다 (화면이 느려 프레임이 드물어도 같은 빠르기, `subSteps`)
      let elapsed = 0;
      for (const dt of subSteps(frameSeconds)) {
        walkFor(dt);
        elapsed += dt;
      }
      // 눌러 둔 건물 문 앞에 닿았으면 (막혀 멈췄어도 문이 가까우면) 들어간다
      if (pending && target === null) {
        const e = pending;
        pending = null;
        if (entranceDistance(pos, e) <= INTERACT_DISTANCE) go(e);
      }
      updateNpcs(npcs, graph, elapsed, Math.random);
      for (const n of npcs) npcTime.set(n.lot, n.walking ? (npcTime.get(n.lot) ?? 0) + elapsed : 0);
      const pose = `${walking ? "walk" : "idle"}-${facing}`;
      if (canvas.dataset.walk !== pose) canvas.dataset.walk = pose;

      // 입구 안내, 그리고 Space·Enter·[들어가기] (멀리서 누른 것은 버린다).
      // 이웃이 자기 집 문 앞에 서 있으면 집 안내와 새 글 말풍선을 한 줄로 합친다 (그 이웃 이름표·말풍선은 쉰다, A2)
      // 초롱은 그 바로 아래에 멈춰 섰을 때만 (분수 둘레를 걸어 지나가는 동안 말풍선이 튀어나와 나를 가리지 않게, D3)
      const near = nearestEntrance(
        pos,
        entrances.filter((e) => !e.id.startsWith("lantern:") || (!walking && target === null && entranceDistance(pos, e) <= LANTERN_REACH)),
      );
      let text = near ? entrancePrompt(near) : null;
      let doorNpc: Npc | null = null;
      if (near && text && near.id.startsWith("house:")) {
        const lot = Number(near.id.slice(6));
        const news = titles.get(lot);
        const n = news ? npcs.find((x) => x.lot === lot) : undefined;
        if (news && n && Math.hypot(n.pos.x - news.door.x, n.pos.y - news.door.y) <= DOORSTEP) {
          doorNpc = n;
          text = `${near.label} · ✉ 새 글 「${shortName(news.title, 12)}」${text.slice(text.indexOf(PROMPT_SPLIT))}`;
        }
      }
      // 창이 열려 있으면 입구 안내는 쉰다 (창 뒤에 반쯤 걸쳐 보이지 않게, D4). Space는 창이 받는다.
      // 축하 쪽지가 떠 있는 동안도 쉰다 (내 집 지붕 위에 상자 둘이 겹치지 않게, D7)
      if (panelOpen || noteShown) text = null;
      if (text !== shown) {
        shown = text;
        setPrompt(text);
      }
      promptNear = text ? near : null;
      if (enterNext) {
        enterNext = false;
        if (near) go(near);
      }

      // 카메라: 펼친 서랍이 덮는 오른쪽은 빼고 가운데를 맞춘다. 세계 오른쪽 끝에서는 동쪽 집이 서랍 왼쪽에 오게 (A2)
      const vw = canvas.clientWidth;
      const vh = canvas.clientHeight;
      // 열린 창이 덮는 왼쪽도 빼고 (D4): 창 오른쪽에 내 자리가 오게. 세계 서쪽 끝이면 창 아래는 숲
      const usable = Math.max(vw / 2, vw - drawerCover - panelCover);
      const leftCover = Math.min(panelCover, vw - usable);
      camera.x =
        vw >= WORLD.width ? (WORLD.width - vw) / 2 : Math.min(Math.max(pos.x - leftCover - usable / 2, -leftCover), WORLD.width - usable - leftCover);
      camera.y = vh >= WORLD.height ? (WORLD.height - vh) / 2 : Math.min(Math.max(pos.y - vh / 2, 0), WORLD.height - vh);
      camera.x = Math.round(camera.x);
      camera.y = Math.round(camera.y);

      // 입구 안내 말풍선: 건물·집이면 그 이름표 자리(지붕 위, 이름표는 쉰다), 공중의 초롱이면 그 초롱 위, 아니면 입구 위. 내 이름표는 가리지 않는다.
      // 화면 가장자리에서 잘리지 않게, 윗변은 화면 위 간판 묶음 아래에 (값이 바뀔 때만 옮긴다)
      const owner = near ? promptOwner.get(near) : undefined;
      if (near && promptBox) {
        // 터치 [들어가기] 버튼은 말풍선 오른쪽에 붙어(absolute) 말풍선 폭에 들지 않으니 그 폭·높이도 남긴다
        const button = touchScreen ? promptBox.querySelector<HTMLElement>("[data-town-enter]") : null;
        const left = promptHalf + 8;
        const right = left + (button ? button.offsetWidth + ENTER_GAP : 0);
        const top = promptTop + Math.max(promptHeight, button ? button.offsetHeight + PROMPT_TAIL : 0);
        // 문이 여럿인 게시판은 그 문 쪽 위에
        // 게시판 세 문은 그 문 위 판 아랫부분에 (게시판 간판 이름표는 그대로 보인다)
        const onBoard = owner === boardStructure && boardStructure !== undefined;
        const anchorX = near.anchor ? near.anchor.x : owner && !onBoard ? owner.x : near.x;
        const anchorY = near.anchor
          ? Math.min(near.anchor.y, pos.y - PROMPT_LIFT)
          : onBoard
            ? Math.min(BOARD_POS.y - BOARD_PLANK_LIFT - 6, pos.y - PROMPT_LIFT)
            : owner
              ? Math.min(owner.y - tagLift.get(owner)!, pos.y - PROMPT_LIFT)
              : Math.min(near.y, pos.y) - PROMPT_LIFT;
        const ax = Math.round(Math.min(Math.max(anchorX - camera.x, left), Math.max(left, vw - right)));
        const ay = Math.round(Math.min(Math.max(anchorY - camera.y, top), vh - 8));
        if (ax !== promptX || ay !== promptY) {
          promptX = ax;
          promptY = ay;
          promptBox.style.transform = `translate(${ax}px, ${ay}px) translate(-50%, -100%)`;
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#5fa34f";
      ctx.fillRect(0, 0, vw, vh);
      ctx.drawImage(ground, camera.x / GROUND_CELL, camera.y / GROUND_CELL, vw / GROUND_CELL, vh / GROUND_CELL, 0, 0, vw, vh);
      if (camera.x + vw > WORLD.width) ctx.drawImage(edgeForest, WORLD.width - camera.x, -camera.y);
      if (camera.x < 0) ctx.drawImage(edgeForest, -EDGE_FOREST - camera.x, -camera.y);
      // 새벽·노을·밤의 먼 하늘 띠
      const skyShown = Math.min(vh, SKY_HEIGHT - camera.y);
      if (band && skyShown > 0) ctx.drawImage(band, camera.x / GROUND_CELL, camera.y / GROUND_CELL, vw / GROUND_CELL, skyShown / GROUND_CELL, 0, 0, vw, skyShown);

      // 클릭한 길 (A1): 땅에 먹색 점선(종이색 테두리)과 도착 X를 1.2초, 끝에서 흐려진다 (움직임 줄이기면 X만)
      if (routeShown) {
        const age = now - routeShown.at;
        if (age > ROUTE_MS) routeShown = null;
        else {
          const fade = still ? 1 : Math.min(1, (ROUTE_MS - age) / ROUTE_FADE_MS);
          // 테두리를 먼저 모두 그리고 먹색 점을 위에 (점끼리 테두리가 겹쳐도 점이 가려지지 않게)
          const dots: [number, number][] = [];
          if (!still) {
            let at = routeShown.from;
            let next = 12;
            for (const p of routeShown.points) {
              const d = Math.hypot(p.x - at.x, p.y - at.y);
              for (; next < d; next += 12) dots.push([at.x + ((p.x - at.x) * next) / d - camera.x, at.y + ((p.y - at.y) * next) / d - camera.y]);
              next -= d;
              at = p;
            }
          }
          const gx = Math.round(routeShown.goal.x - camera.x);
          const gy = Math.round(routeShown.goal.y - camera.y);
          const cross: [number, number][] = [];
          for (let i = -2; i <= 2; i++) cross.push([gx + i * 3, gy + i * 3], [gx + i * 3, gy - i * 3]);
          ctx.globalAlpha = 0.8 * fade;
          ctx.fillStyle = "#fbf1dc";
          for (const [x, y] of dots) ctx.fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6);
          for (const [x, y] of cross) ctx.fillRect(x - 3, y - 3, 6, 6);
          ctx.fillStyle = LANTERN.ink;
          ctx.globalAlpha = 0.55 * fade;
          for (const [x, y] of dots) ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
          ctx.globalAlpha = 0.85 * fade;
          for (const [x, y] of cross) ctx.fillRect(x - 2, y - 2, 4, 4);
          ctx.globalAlpha = 1;
        }
      }

      // 아랫변 y 순서로 그린다 (앞에 있는 것이 위에)
      items.length = 0;
      used = 0;
      for (const s of structures) {
        const { width, height } = artSize(s.art);
        const left = s.x - width / 2 - camera.x;
        const top = s.y - height - camera.y;
        if (left > vw || top > vh || left + width < 0 || top + height + 40 < 0) continue;
        put(s.y, s, null);
      }
      walkStep = walking ? 1 + (Math.floor(walkTime * WALK_FPS) % WALK_FRAMES) : 0;
      put(pos.y + 8, null, null);
      for (const n of npcs) {
        const nx = n.pos.x - camera.x;
        const ny = n.pos.y - camera.y;
        if (nx < -40 || nx > vw + 40 || ny < -10 || ny > vh + PLAYER_SIZE) continue;
        put(n.pos.y + 8, null, n);
      }
      items.sort(byY);
      for (const item of items) {
        if (item.s) drawStructure(item.s);
        else if (item.n) drawNpc(item.n);
        else drawPlayer();
      }

      // 줄등 (A4): 줄과 초롱은 머리 위 높이라 모든 것 위에 (덧칠은 받는다)
      const ropesOnScreen = ropeBox.right - camera.x > 0 && ropeBox.left - camera.x < vw && ropeBox.bottom - camera.y > 0 && ropeBox.top - camera.y - 80 < vh;
      const boxes = lanterns.map((l) => lanternBox(l, !still));
      if (ropesOnScreen) {
        ctx.drawImage(ropeLayer, ropeBox.left - camera.x, ropeBox.top - camera.y);
        lanterns.forEach((l, i) => {
          const b = boxes[i];
          // 매단 끈: 줄 점에서 초롱 꼭지까지 (흔들려 비켜 있어도 이어진다)
          if (l.size === "m") {
            ctx.fillStyle = LANTERN.ink;
            const kx = b.x + b.width / 2;
            ctx.fillRect(Math.round(Math.min(kx, l.hook.x) - 1 - camera.x), Math.round(l.hook.y - camera.y), Math.max(2, Math.round(Math.abs(kx - l.hook.x)) + 2), 2);
          }
          ctx.drawImage(lanternSprites[l.size][l.lit ? 1 : 0], b.x - camera.x, b.y - camera.y);
        });
      }

      // 하늘 덧칠 (낮은 건너뛴다): 세계 전체에 한 번
      if (tint) {
        ctx.globalCompositeOperation = "multiply";
        ctx.globalAlpha = tint.alpha;
        ctx.fillStyle = tint.color;
        ctx.fillRect(0, 0, vw, vh);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
      // 노을 빛 띠 (A5): 화면 위 35%에 주황빛이 아래로 사라진다
      if (currentSky === "dusk" && duskBand) {
        if (duskBand.height !== Math.round(vh * DUSK_GLOW.height)) duskBand = bakeDuskBand(vh);
        ctx.drawImage(duskBand, 0, 0, vw, duskBand.height);
      }
      if (stars && currentSky === "night" && skyShown > 0) ctx.drawImage(stars, camera.x / GROUND_CELL, camera.y / GROUND_CELL, vw / GROUND_CELL, skyShown / GROUND_CELL, 0, 0, vw, skyShown);

      // 덧칠 위에 다시 얹는 것 (앞에 선 캐릭터 자리는 비운다): 밤 지붕색, 불 켜진 창·처마 초롱
      const px = pos.x - camera.x;
      const py = pos.y - camera.y;
      const overlay = (img: HTMLCanvasElement, s: Structure, wx: number, wy: number, width: number, height: number) => {
        const x = wx - camera.x;
        const y = wy - camera.y;
        if (x > vw || y > vh || x + width < 0 || y + height < 0) return;
        let hidden = pos.y > s.y && covers(px, py, x, y, width, height);
        for (const n of npcs) if (!hidden && n.pos.y > s.y && covers(n.pos.x - camera.x, n.pos.y - camera.y, x, y, width, height)) hidden = true;
        if (hidden) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, width, height);
          if (pos.y > s.y) ctx.rect(px - 18, py - 60, 36, 60);
          for (const n of npcs) if (n.pos.y > s.y) ctx.rect(n.pos.x - camera.x - 18, n.pos.y - camera.y - 60, 36, 60);
          ctx.clip("evenodd");
          ctx.drawImage(img, Math.round(x), Math.round(y));
          ctx.restore();
        } else ctx.drawImage(img, Math.round(x), Math.round(y));
      };
      if (currentSky === "night") for (const r of roofs) overlay(r.img, r.s, r.left, r.top, r.width, r.height);
      if (strength > 0) {
        ctx.globalAlpha = strength;
        for (const l of litHouses) overlay(l.stages[stageOf(l, now)].glass, l.s, l.left, l.top, l.width, l.height);
        if (lampOn) {
          for (const s of lamps) {
            const { width, height } = artSize(lampLit);
            const x = s.x - width / 2 - camera.x;
            const y = s.y - height - camera.y;
            if (x > vw || y > vh || x + width < 0 || y + height < 0) continue;
            ctx.drawImage(lampGlass, Math.round(x), Math.round(y));
          }
        }
        ctx.globalCompositeOperation = "lighter";
        for (const l of litHouses) {
          const st = l.stages[stageOf(l, now)];
          for (const w of st.windows) glowAt(windowGlow, w.x - camera.x, w.y - camera.y, vw, vh);
          for (const sp of st.spills) {
            const x = Math.round(sp.x - 15 - camera.x);
            const y = Math.round(sp.y - camera.y);
            if (x < vw && y < vh && x + 30 > 0 && y + 18 > 0) ctx.drawImage(spillGlow, x, y);
          }
        }
        if (lampOn) {
          for (const s of lamps) {
            const head = s.y - artSize(lampLit).height + 2 * TOWN_CELL;
            glowAt(lampGlow, s.x - camera.x, head - camera.y, vw, vh);
            glowAt(poolGlow, s.x - camera.x, s.y - camera.y, vw, vh);
          }
        }
        // 켜진 초롱 빛 무리: 글이 최근일수록 밝다 (0~8시간 1, 8~16시간 0.7, 16~24시간 0.4)
        if (ropesOnScreen)
          lanterns.forEach((l, i) => {
            if (!l.lit) return;
            ctx.globalAlpha = strength * l.brightness;
            glowAt(lanternGlow, boxes[i].x + boxes[i].width / 2 - camera.x, boxes[i].y + boxes[i].height / 2 - camera.y, vw, vh);
          });
        ctx.globalCompositeOperation = "source-over";
        // 켜진 초롱은 안에서 빛나 비단 색 그대로 빛 무리 위에 다시 얹는다 (밤에도 붉은·푸른 청사초롱으로 읽힌다)
        ctx.globalAlpha = strength;
        if (ropesOnScreen)
          lanterns.forEach((l, i) => {
            if (l.lit) ctx.drawImage(lanternSprites[l.size][1], boxes[i].x - camera.x, boxes[i].y - camera.y);
          });
        ctx.globalAlpha = 1;
      }

      // 오늘 할 일 '!' 쪽지 (A3): 두 장으로 위아래 흔들린다 (움직임 줄이기면 멈춘다)
      for (const m of markers) {
        const b = markerBox(m, still ? 0 : (Math.floor(now / 500) % 2) * TOWN_CELL);
        const x = b.x - camera.x;
        const y = b.y - camera.y;
        if (x > vw || y > vh || x + b.width < 0 || y + b.height < 0) continue;
        ctx.drawImage(markerSprites[0], x, y);
      }
      // 불꽃 (A3 할 일 다 함, C2 내 초롱 켜기): 네 장 한 번. 움직임 줄이기면 건너뛴다
      for (const sp of sparks) {
        const f = Math.floor((now - sp.at) / SPARK_MS);
        if (still || f < 0 || f >= SPARK_FRAMES) continue;
        const img = sparkSprites[f];
        ctx.drawImage(img, Math.round(sp.x - img.width / 2 - camera.x), Math.round(sp.y - img.height / 2 - camera.y));
      }
      // 이름표는 맨 위에: 건물 간판은 늘, 집 문패와 빈 집터 팻말은 가까이 가거나 마우스를 올렸을 때만 (내 집은 늘)
      const drawn: string[] = [];
      for (const s of labeled) {
        // 입구 안내 말풍선이 이 이름표 자리에 떠 있다 (게시판은 문 위에 떠서 간판은 그대로)
        if (s === owner && s !== boardStructure) continue;
        const kind = s.tag ?? "sign";
        if (kind !== "sign" && s.id !== mineId && s !== hoverStructure) {
          const limit = kind === "lot" ? LOT_DISTANCE : PLATE_DISTANCE;
          if (Math.hypot(s.x - pos.x, s.y - pos.y) > limit) continue;
        }
        const x = s.x - camera.x;
        const y = s.y - tagLift.get(s)! - camera.y;
        if (x < -150 || x > vw + 150 || y < -20 || y > vh + 60) continue;
        const style = kind === "sign" ? "sign" : s.id === mineId ? "mine" : "plate";
        if (underHud(x, y, tags.size(s.label!, style))) continue;
        tags.draw(ctx, s.label!, style, x, y);
        drawn.push(s.label!);
      }
      // 이웃 이름표: 가까이 가거나 마우스를 올렸을 때만. 가장 가까운 새 글 이웃 한 명은 새 글 제목 말풍선 (누르면 그 글)
      const hovered = hover ? npcAt(hover) : undefined;
      let speaker: Npc | null = null;
      let speakerDistance = BUBBLE_DISTANCE;
      for (const n of npcs) {
        if (!titles.has(n.lot) || n === doorNpc) continue;
        const d = Math.hypot(n.pos.x - pos.x, n.pos.y - pos.y);
        if (d <= speakerDistance) {
          speaker = n;
          speakerDistance = d;
        }
      }
      bubbleHit = null;
      for (const n of npcs) {
        // 문 앞 이웃은 입구 안내에 합쳤다
        if (n === doorNpc) continue;
        if (n !== hovered && n !== speaker && Math.hypot(n.pos.x - pos.x, n.pos.y - pos.y) > NPC_TAG_DISTANCE) continue;
        const x = n.pos.x - camera.x;
        const y = n.pos.y - camera.y - PLAYER_SIZE;
        if (x < -150 || x > vw + 150 || y < -20 || y > vh + 60) continue;
        const plate = npcNames.get(n.lot) ?? "";
        if (underHud(x, y, tags.size(plate, "plate"))) continue;
        const height = tags.draw(ctx, plate, "plate", x, y);
        if (n !== speaker) continue;
        // 입구 안내 말풍선과 겹치면 안내가 먼저 (제목 말풍선은 쉰다)
        const news = titles.get(n.lot)!;
        const size = tags.size(news.text, "bubble");
        const bottom = y - height - 2;
        const underPrompt = shown !== null && Math.abs(x - promptX) < size.width / 2 + promptHalf && bottom > promptY - promptHeight && bottom - size.height < promptY;
        if (!underPrompt && !underHud(x, bottom, size)) {
          tags.draw(ctx, news.text, "bubble", x, bottom);
          bubbleHit = { lot: n.lot, href: news.href, x: x - size.width / 2, y: bottom - size.height, width: size.width, height: size.height };
        }
      }
      // 글 쓰고 돌아온 순간의 쪽지 (C2): 창이 다 켜지면 내 집 오른쪽 위에 잠깐
      if (celebrateNote && celebrateLitAt !== null && mineStructure) {
        const age = now - (still ? celebrateStart! : celebrateLitAt);
        if (age >= 0 && age < CELEBRATE.note) {
          if (!noteShown) {
            noteShown = true;
            setNote(celebrateNote);
          }
          const x = mineStructure.x + 150 - camera.x;
          const y = mineStructure.y - artVisibleHeight(mineStructure.art) + 34 - camera.y;
          ctx.globalAlpha = still ? 1 : Math.min(1, age / 200, (CELEBRATE.note - age) / 400);
          if (!underHud(x, y, tags.size(celebrateNote, "bubble"))) tags.draw(ctx, celebrateNote, "bubble", x, y);
          ctx.globalAlpha = 1;
        } else if (noteShown && age >= CELEBRATE.note) {
          noteShown = false;
          setNote(null);
        }
      }
      tags.draw(ctx, name, "player", pos.x - camera.x, pos.y - camera.y - PLAYER_SIZE);
      lastPos.current = { from, pos };
      if (frame++ % 3 === 0) {
        canvas.dataset.feet = `${Math.round(pos.x)},${Math.round(pos.y)}`;
        canvas.dataset.camera = `${camera.x},${camera.y}`;
        // 시험 훅 (광장 개편 2): 지금 그린 이름표 글자, 지금 그린 말풍선 (`자리:가운데x,y`, 캔버스 안 좌표)
        canvas.dataset.tags = drawn.join("|");
        canvas.dataset.bubbles = bubbleHit ? `${bubbleHit.lot}:${Math.round(bubbleHit.x + bubbleHit.width / 2)},${Math.round(bubbleHit.y + bubbleHit.height / 2)}` : "";
        // 게시판 가까이 서면 위 가운데 장소 간판을 접는다 (게시판 이름표를 가리지 않게)
        const compactNow = Math.hypot(pos.x - BOARD_POS.x, pos.y - BOARD_POS.y) <= BOARD_COMPACT;
        if (compactNow !== compact) {
          compact = compactNow;
          window.dispatchEvent(new CustomEvent(COMPACT_EVENT, { detail: { compact } }));
        }
        // 시험 훅: 지금 걷는 이웃 수, 화면에 보이는(메뉴·창에 가리지 않은) 이웃의 자리 번호와 몸 가운데 (캔버스 안 좌표)
        canvas.dataset.npcWalking = String(npcs.filter((n) => n.walking).length);
        const rect = canvas.getBoundingClientRect();
        canvas.dataset.npcAt = npcs
          .map((n) => ({ lot: n.lot, x: Math.round(n.pos.x - camera.x), y: Math.round(n.pos.y - camera.y - PLAYER_SIZE / 2) }))
          .filter((n) => n.x > 0 && n.x < vw && n.y > 0 && n.y < vh && document.elementFromPoint(rect.left + n.x, rect.top + n.y) === canvas)
          .map((n) => `${n.lot}:${n.x},${n.y}`)
          .join(" ");
        // 내가 선 구역 (HUD 장소 간판)
        const z = zoneAt(pos);
        if (z !== zone) {
          zone = z;
          canvas.dataset.zone = z;
          emitTown("bv-zone", { zone: z });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    let raf = requestAnimationFrame(tick);
    canvas.dataset.ready = "1";
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      hudObserver.disconnect();
      promptObserver.disconnect();
      motion.removeEventListener("change", onMotion);
      offMail();
      offEnter();
      offPanel();
      window.removeEventListener("bv-note", onNote);
      for (const t of noteTimers) window.clearTimeout(t);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("pointerdown", onPointer);
      canvas.removeEventListener("pointermove", onHover);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("bv-teleport", onTeleport);
      delete canvas.dataset.ready;
      if (compact) window.dispatchEvent(new CustomEvent(COMPACT_EVENT, { detail: { compact: false } }));
    };
  }, [data, phone, router]);

  const hint = touch ? (
    <>
      탭으로 이동<span className="sr-only"> · </span>
      <span className="block">건물을 탭해서 들어가기</span>
    </>
  ) : (
    <>
      방향키·WASD 또는 클릭으로 이동<span className="sr-only"> · </span>
      <span className="block">
        건물 가까이에서 <kbd className="px-key">Space</kbd>로 들어가기
      </span>
    </>
  );

  return (
    <div className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none select-none"
        aria-label={`${place} 지도. 방향키로 걷고 Space로 들어가요`}
        data-feet={`${start.x},${start.y}`}
        // 시험 훅: 집 자리마다 지붕 색 (TOWN-07)
        data-roofs={houses.map((h) => `${h.lot}:${h.roof}`).join(" ")}
        // 시험 훅: 계단마다 `위x,위y,아래x,아래y` (TOWN-05)
        data-stairs={STAIRS.map((st) => {
          const { top, bottom } = stairEnds(st);
          return `${top.x},${top.y},${bottom.x},${bottom.y}`;
        }).join(" ")}
      />
      {/* 입구 안내: 세계 안 그 입구 위에 뜨는 종이 말풍선 (자리는 게임이 transform으로 옮긴다) */}
      <div ref={promptRef} className="pointer-events-none absolute left-0 top-0 z-10 pb-[10px] will-change-transform">
        <p role="status" className={`px-bubble px-float whitespace-nowrap px-3 py-1.5 text-[15px] font-semibold leading-6 ${prompt ? "" : "hidden"}`} data-town-prompt>
          {prompt && <PromptText text={prompt} touch={touch} />}
        </p>
        {touch && prompt && (
          <button
            type="button"
            className="px-btn px-btn--primary pointer-events-auto absolute bottom-[10px] left-full ml-3"
            data-town-enter
            onClick={(event) => {
              emitTown("bv-enter", {});
              // 다음 Space가 버튼이 아니라 게임으로 가게
              event.currentTarget.blur();
            }}
          >
            {/* 말풍선에서 뺀 동작 이름 (들어가기·소식 보기·이웃 자리 고르기·로그인하고 이용하기) */}
            {prompt.includes(PROMPT_SPLIT) ? prompt.slice(prompt.indexOf(PROMPT_SPLIT) + PROMPT_SPLIT.length) : "들어가기"}
          </button>
        )}
      </div>
      {/* 글 쓰고 돌아온 순간의 쪽지 (C2): 캔버스에 그리고, 화면 낭독기에는 여기서 읽힌다 */}
      <p role="status" className="sr-only" data-town-note>
        {note ?? ""}
      </p>
      {hintFolded ? (
        <div className="group absolute bottom-4 right-4 flex flex-col items-end gap-3">
          <p id="town-hint" className="px-box px-float hidden px-3 py-2 text-[13px] leading-5 group-focus-within:block group-hover:block" data-town-hint>
            {hint}
          </p>
          <button type="button" className="px-plank px-font-2x inline-flex min-h-11 min-w-11 items-center justify-center" aria-label="조작 안내" aria-describedby="town-hint">
            ?
          </button>
        </div>
      ) : (
        <p className="px-box px-float pointer-events-none absolute bottom-4 right-4 max-w-[calc(100%-2rem)] px-3 py-2 text-[13px] leading-5" data-town-hint>
          {hint}
        </p>
      )}
    </div>
  );
}
