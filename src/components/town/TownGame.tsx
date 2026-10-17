"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { findArt } from "@/lib/art";
import { pixelRects, type PixelArt } from "@/lib/art/characters";
import { walkDir, walkFrame, WALK_DIRS, WALK_FPS, WALK_FRAMES, type ColorGrid, type WalkDir } from "@/lib/art/walk";
import { cellGroups, chimneyTop, glowCells, lampArt, LIT_GLOW, mailboxArt, smokeArt, SMOKE_FRAMES, TOWN_CELL } from "@/lib/art/town";
import { BOARD_POS, entranceDistance, HOUSE_LOTS, INTERACT_DISTANCE, lotFront, PLAYER_SIZE, shortName, SPEED, subSteps, WORLD, nearestEntrance, normalize, step, type Point } from "@/lib/town/layout";
import { createNpcs, NPC_TAG_DISTANCE, npcGraph, updateNpcs, type Npc } from "@/lib/town/npc";
import {
  artSize,
  artVisibleHeight,
  entranceOwner,
  entrancePrompt,
  lotChoice,
  mailboxLot,
  structureAt as structureAtPoint,
  townLayout,
  type BoardState,
  type Structure,
  type TownEntrance,
  type TownHouseInput,
} from "@/lib/town/structures";
import { emitTown, onTown } from "@/lib/town/events";
import { lampsOn, msUntilNextSky, skyAt, SKY_TINT, type Sky } from "@/lib/town/sky";
import { zoneAt, type Zone } from "@/lib/town/zones";
import { onStairs, SKY_HEIGHT, STAIR_SLOW, stairEnds, STAIRS } from "@/lib/town/terrain";
import { bubbleText, PIXEL_FONT_PROBE, TagCache } from "./canvas-text";
import { bakeGlow, bakeGround, bakeSkyBand, bakeStars, GROUND_CELL } from "./ground";

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
}: {
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
  // 이 화면을 연 횟수는 한 번만 센다 (집 목록이 바뀌어 게임을 다시 만들어도)
  const visited = useRef(false);
  const data = JSON.stringify({ houses, member, layers, name, start, startKey, mailFlag, chooseLots, sky, board });
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
    };
    const { houses, member, layers, name, start, startKey, mailFlag, chooseLots, board } = parsed;
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
    const { structures, entrances, walls } = townLayout(houses, member, mailFlag, chooseLots, board);
    const bodies = [...walls, ...structures.flatMap((s) => (s.body ? [s.body] : []))];
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
    const doors = new Map(structures.map((s) => [s, entrances.filter((e) => e.id === s.id || (s.id === "board" && (e.id === "feed" || e.id === "attendance")))]));
    const mineHouse = houses.find((h) => h.mine);
    const mineId = mineHouse ? `house:${mineHouse.lot}` : null;

    // 글 쓴 집 (fresh): 불 켜진 창 덧칠, 창마다 빛 무리 자리, 굴뚝 연기 자리 (세계 좌표)
    const litHouses = structures
      .filter((s) => s.lit)
      .map((s) => {
        const { width, height } = artSize(s.art);
        const left = s.x - width / 2;
        const top = s.y - height;
        const chimney = chimneyTop(s.art);
        return {
          s,
          left,
          top,
          width,
          height,
          glass: bake([glowCells(s.art, "G", LIT_GLOW)], TOWN_CELL),
          windows: cellGroups(s.art, "G").map((c) => ({ x: left + c.x * TOWN_CELL, y: top + c.y * TOWN_CELL })),
          smoke: chimney ? { x: left + chimney.x * TOWN_CELL, y: top + chimney.y * TOWN_CELL } : null,
        };
      });
    const smokeAt = new Map(litHouses.map((l) => [l.s, l.smoke]));
    const smokeSprites = Array.from({ length: SMOKE_FRAMES }, (_, f) => bake([smokeArt(f)], TOWN_CELL));
    const lampGlow = bakeGlow(64, 64, WARM, [0.34, 0.2, 0.09]);
    const poolGlow = bakeGlow(60, 22, WARM, [0.26, 0.12]);
    const windowGlow = bakeGlow(36, 30, WARM, [0.5, 0.26, 0.1]);
    const glowAt = (glow: HTMLCanvasElement, x: number, y: number, vw: number, vh: number) => {
      const w = glow.width * GROUND_CELL;
      const h = glow.height * GROUND_CELL;
      const left = Math.round(x - w / 2);
      const top = Math.round(y - h / 2);
      if (left > vw || top > vh || left + w < 0 || top + h < 0) return;
      ctx.drawImage(glow, left, top, w, h);
    };

    // 시험 훅: 불 켜진 집 자리, 게시판 쪽지·도장, 내 우체통 깃발 (깃발은 `bv-mail`로 바뀌어도 React가 되돌리지 않게 여기서만 쓴다)
    canvas.dataset.lit = houses
      .filter((h) => h.fresh)
      .map((h) => h.lot)
      .sort((a, b) => a - b)
      .join(" ");
    canvas.dataset.board = `${board.papers},${board.stamps}`;
    let mailFlagNow = mailFlag;
    canvas.dataset.mailFlag = mailFlag ? "1" : "0";
    const myMailbox = mineHouse ? structures.find((s) => s.id === `mailbox:${mineHouse.lot}`) : undefined;

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
    const bakeSheet = (keys: readonly string[]) => {
      const arts = keys.map(findArt).filter((a): a is PixelArt => a !== undefined);
      const sheet = new Map<string, HTMLCanvasElement>();
      if (arts.length > 0) {
        for (const d of WALK_DIRS) for (let f = 0; f <= WALK_FRAMES; f++) sheet.set(`${d}:${f}`, bakeGrid(walkFrame(arts, d, f), PLAYER_SIZE / 16));
      }
      return sheet;
    };
    const walkSheet = bakeSheet(layers);

    // 걸어 다니는 이웃 (TOWN-19): 집이 선 이웃(1~10번)이 흙길을 걷는다. 내 집(0번) 앞에는 오지 않는다
    const graph = npcGraph(bodies, lotFront(0), HOUSE_LOTS.map((_, i) => lotFront(i)));
    const npcs = createNpcs(
      graph,
      houses.filter((h) => h.lot > 0),
      Math.random,
    );
    const npcSheets = new Map<number, Map<string, HTMLCanvasElement>>();
    for (const h of houses) if (h.lot > 0) npcSheets.set(h.lot, bakeSheet(h.layers && h.layers.length > 0 ? h.layers : ["char.visitor"]));
    const npcNames = new Map(houses.map((h) => [h.lot, shortName(h.nickname)]));
    // 글 쓴 이웃의 새 글 제목 (말풍선)
    const titles = new Map(houses.filter((h) => h.fresh && h.lot > 0 && h.latestTitle).map((h) => [h.lot, bubbleText(h.latestTitle!)]));
    const npcTime = new Map<number, number>();
    canvas.dataset.npcs = String(npcs.length);
    // 마우스가 올라간 곳 (이웃 이름표·집 문패)
    let hover: Point | null = null;
    let hoverStructure: Structure | null = null;
    const npcAt = (p: Point): Npc | undefined =>
      npcs.find((n) => Math.abs(p.x - n.pos.x) <= 22 && p.y >= n.pos.y - PLAYER_SIZE + 8 && p.y <= n.pos.y + 4);
    // 그림의 칠한 칸만 (집 양옆 풀밭을 눌렀으면 집이 아니라 그 풀밭으로 걷는다)
    const structureAt = (p: Point): Structure | undefined => structureAtPoint(structures, p);
    // 입구마다 안내 말풍선을 띄울 이름표 자리 (건물·집). 없으면 입구 위
    const promptOwner = new Map(entrances.map((e) => [e, entranceOwner(e, structures)]));
    const ground = bakeGround();

    // 시작 자리(?at)가 바뀌었으면 새 자리에서. 환영(?welcome)을 주소에서 지운 뒤 다시 그려도 자리는 그대로
    const from = startKey;
    let pos: Point = lastPos.current?.from === from ? lastPos.current.pos : { ...start };
    let target: Point | null = null;
    // 멀리 있는 건물을 눌렀으면 그 문 앞에 닿는 순간 들어간다
    let pending: TownEntrance | null = null;
    let enterNext = false;
    let facing: WalkDir = "down";
    let walking = false;
    let walkTime = 0;
    let shown: string | null = null;
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
    const measureHud = () => {
      const c = canvas.getBoundingClientRect();
      promptTop = PROMPT_TOP;
      hudRects = [];
      for (const el of document.querySelectorAll<HTMLElement>("[data-town-hud-row], [data-town-drawer]")) {
        const r = el.getBoundingClientRect();
        if (r.height === 0) continue;
        hudRects.push({ left: r.left - c.left, top: r.top - c.top, right: r.right - c.left, bottom: r.bottom - c.top });
        if (el.hasAttribute("data-town-hud-row")) promptTop = Math.max(promptTop, Math.round(r.bottom - c.top) + 12);
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

    const onKeyDown = (event: KeyboardEvent) => {
      // 게임이 보이지 않으면(휴대폰 폭으로 줄인 사이) 키를 가져가지 않는다
      if (canvas.clientWidth === 0 || yieldsKey(event)) return;
      if (MOVE_KEYS[event.code]) {
        held.add(event.code);
        target = null;
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
      // 걷는 이웃을 누르면 그 집 우체통 (TOWN-19)
      const npc = npcAt(p);
      if (npc) {
        fromNpc(npc.lot);
        return;
      }
      // 건물·집을 눌렀으면 그 입구로 (가까우면 바로 들어가고, 멀면 걸어가서 닿으면 들어간다)
      const hit = structureAt(p);
      const door = hit && doors.get(hit);
      if (hit && door && door.length > 0) {
        const e = door.length === 1 ? door[0] : p.x < hit.x ? door[0] : door[1];
        if (entranceDistance(pos, e) <= INTERACT_DISTANCE) return go(e);
        target = { x: e.x, y: e.y };
        pending = e;
      } else {
        target = p;
      }
    };
    const fromNpc = (lot: number) => window.dispatchEvent(new CustomEvent("bv-mailbox", { detail: { lot } }));
    const onHover = (event: PointerEvent) => {
      hover = toWorld(event);
      const npc = npcAt(hover);
      hoverStructure = npc ? null : (structureAt(hover) ?? null);
      canvas.style.cursor = npc || (hoverStructure && (doors.get(hoverStructure)?.length ?? 0) > 0) ? "pointer" : "";
    };
    const onLeave = () => {
      hover = null;
      hoverStructure = null;
    };
    const onTeleport = (event: Event) => {
      const { x, y } = (event as CustomEvent<Point>).detail;
      pos = { x, y };
      target = null;
      pending = null;
    };
    const offMail = onTown("bv-mail", ({ flag }) => {
      if (flag === mailFlagNow) return;
      mailFlagNow = flag;
      canvas.dataset.mailFlag = flag ? "1" : "0";
      // 내 우체통 그림만 다시 굽는다 (게임은 그대로)
      if (myMailbox) myMailbox.art = mailboxArt(true, flag);
    });
    const offEnter = onTown("bv-enter", () => {
      enterNext = true;
    });
    // 걸어가는 사이에 창(☰·지갑·우체통)을 열면 문 앞에 닿아도 들어가지 않는다 (걷기는 그대로)
    const offPanel = onTown("bv-panel", ({ open }) => {
      if (open) pending = null;
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
    const artOf = (s: Structure): PixelArt => {
      if (lamps.has(s)) return lampOn ? lampLit : lampDark;
      if (s.frames) return s.frames[still ? 0 : anim % s.frames.length];
      return s.art;
    };
    const drawStructure = (s: Structure) => {
      const art = artOf(s);
      const { width, height } = artSize(art);
      const left = s.x - width / 2 - camera.x;
      const top = s.y - height - camera.y;
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.beginPath();
      ctx.ellipse(left + width / 2, top + height - 2, width * 0.42, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(sprite(art), Math.round(left), Math.round(top));
      // 글 쓴 집의 굴뚝 연기 (아랫변 가운데 = 굴뚝 꼭대기 바로 위)
      const smoke = s.lit ? smokeAt.get(s) : null;
      if (smoke) {
        const puff = smokeSprites[still ? 0 : anim % SMOKE_FRAMES];
        ctx.globalAlpha = 0.92;
        ctx.drawImage(puff, Math.round(smoke.x - 3.5 * TOWN_CELL - camera.x), Math.round(smoke.y - 11 * TOWN_CELL - camera.y));
        ctx.globalAlpha = 1;
      }
      // 게시판 두 입구 위 나무 팻말 (판 아래에 매달려 있어 앞에 선 캐릭터에 가린다)
      if (s === boardStructure) {
        tags.draw(ctx, "소식", "sign", BOARD_POS.x - 60 - camera.x, BOARD_POS.y - 24 - camera.y);
        tags.draw(ctx, "출석", "sign", BOARD_POS.x + 60 - camera.x, BOARD_POS.y - 24 - camera.y);
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
    /** `dt`초만큼 걷는다 (한 걸음은 `MAX_STEP_SECONDS` 이하라 몸체를 뚫고 지나가지 않는다). 키보드가 클릭 목표보다 먼저 */
    const walkFor = (dt: number) => {
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
      if (dir.x === 0 && dir.y === 0) {
        walking = false;
        walkTime = 0;
        return;
      }
      // 계단에서는 조금 느리게 (TOWN-05). 목표를 지나치지 않게 남은 거리까지만
      const speed = onStairs(pos) ? SPEED * STAIR_SLOW : SPEED;
      const reach = held.size === 0 && target ? Math.min(speed * dt, Math.hypot(target.x - pos.x, target.y - pos.y)) : speed * dt;
      const next = step(pos, { x: dir.x * reach, y: dir.y * reach }, bodies);
      // 클릭 목표로 가다 막히면 멈춘다
      stuck = Math.hypot(next.x - pos.x, next.y - pos.y) < 0.5 ? stuck + dt : 0;
      if (stuck > 0.25) target = null;
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

      // 입구 안내, 그리고 Space·Enter·[들어가기] (멀리서 누른 것은 버린다)
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

      // 입구 안내 말풍선: 건물·집이면 그 이름표 자리(지붕 위, 이름표는 쉰다), 아니면 입구 위. 내 이름표는 가리지 않는다.
      // 화면 가장자리에서 잘리지 않게, 윗변은 화면 위 간판 묶음 아래에 (값이 바뀔 때만 옮긴다)
      const owner = near ? promptOwner.get(near) : undefined;
      if (near && promptBox) {
        // 터치 [들어가기] 버튼은 말풍선 오른쪽에 붙어(absolute) 말풍선 폭에 들지 않으니 그 폭·높이도 남긴다
        const button = touchScreen ? promptBox.querySelector<HTMLElement>("[data-town-enter]") : null;
        const left = promptHalf + 8;
        const right = left + (button ? button.offsetWidth + ENTER_GAP : 0);
        const top = promptTop + Math.max(promptHeight, button ? button.offsetHeight + PROMPT_TAIL : 0);
        // 문이 둘인 게시판은 그 문 쪽 위에
        const anchorX = owner && (doors.get(owner)?.length ?? 0) < 2 ? owner.x : near.x;
        const anchorY = owner ? Math.min(owner.y - tagLift.get(owner)!, pos.y - PROMPT_LIFT) : Math.min(near.y, pos.y) - PROMPT_LIFT;
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
      // 새벽·노을·밤의 먼 하늘 띠
      const skyShown = Math.min(vh, SKY_HEIGHT - camera.y);
      if (band && skyShown > 0) ctx.drawImage(band, camera.x / GROUND_CELL, camera.y / GROUND_CELL, vw / GROUND_CELL, skyShown / GROUND_CELL, 0, 0, vw, skyShown);

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

      // 하늘 덧칠 (낮은 건너뛴다): 세계 전체에 한 번
      if (tint) {
        ctx.globalCompositeOperation = "multiply";
        ctx.globalAlpha = tint.alpha;
        ctx.fillStyle = tint.color;
        ctx.fillRect(0, 0, vw, vh);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
      if (stars && currentSky === "night" && skyShown > 0) ctx.drawImage(stars, camera.x / GROUND_CELL, camera.y / GROUND_CELL, vw / GROUND_CELL, skyShown / GROUND_CELL, 0, 0, vw, skyShown);

      // 불빛: 덧칠 위에 불 켜진 창·등을 다시 얹고(앞에 선 캐릭터 자리는 비운다), 빛 무리를 더한다. 화면 밖은 건너뛴다
      if (strength > 0) {
        ctx.globalAlpha = strength;
        for (const l of litHouses) {
          const x = l.left - camera.x;
          const y = l.top - camera.y;
          if (x > vw || y > vh || x + l.width < 0 || y + l.height < 0) continue;
          const px = pos.x - camera.x;
          const py = pos.y - camera.y;
          let hidden = pos.y > l.s.y && covers(px, py, x, y, l.width, l.height);
          for (const n of npcs) if (!hidden && n.pos.y > l.s.y && covers(n.pos.x - camera.x, n.pos.y - camera.y, x, y, l.width, l.height)) hidden = true;
          if (hidden) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, l.width, l.height);
            if (pos.y > l.s.y) ctx.rect(px - 18, py - 60, 36, 60);
            for (const n of npcs) if (n.pos.y > l.s.y) ctx.rect(n.pos.x - camera.x - 18, n.pos.y - camera.y - 60, 36, 60);
            ctx.clip("evenodd");
            ctx.drawImage(l.glass, Math.round(x), Math.round(y));
            ctx.restore();
          } else ctx.drawImage(l.glass, Math.round(x), Math.round(y));
        }
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
        for (const l of litHouses) for (const w of l.windows) glowAt(windowGlow, w.x - camera.x, w.y - camera.y, vw, vh);
        if (lampOn) {
          for (const s of lamps) {
            const head = s.y - artSize(lampLit).height + 2 * TOWN_CELL;
            glowAt(lampGlow, s.x - camera.x, head - camera.y, vw, vh);
            glowAt(poolGlow, s.x - camera.x, s.y - camera.y, vw, vh);
          }
        }
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }

      // 이름표는 맨 위에: 건물 간판은 늘, 집 문패와 빈 집터 팻말은 가까이 가거나 마우스를 올렸을 때만 (내 집은 늘)
      for (const s of labeled) {
        // 입구 안내 말풍선이 이 이름표 자리에 떠 있다
        if (s === owner) continue;
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
      }
      // 이웃 이름표: 가까이 가거나 마우스를 올렸을 때만. 가장 가까운 글 쓴 이웃 한 명은 새 글 제목 말풍선
      const hovered = hover ? npcAt(hover) : undefined;
      let speaker: Npc | null = null;
      let speakerDistance = BUBBLE_DISTANCE;
      for (const n of npcs) {
        if (!titles.has(n.lot)) continue;
        const d = Math.hypot(n.pos.x - pos.x, n.pos.y - pos.y);
        if (d <= speakerDistance) {
          speaker = n;
          speakerDistance = d;
        }
      }
      for (const n of npcs) {
        if (n !== hovered && n !== speaker && Math.hypot(n.pos.x - pos.x, n.pos.y - pos.y) > NPC_TAG_DISTANCE) continue;
        const x = n.pos.x - camera.x;
        const y = n.pos.y - camera.y - PLAYER_SIZE;
        if (x < -150 || x > vw + 150 || y < -20 || y > vh + 60) continue;
        const plate = npcNames.get(n.lot) ?? "";
        if (underHud(x, y, tags.size(plate, "plate"))) continue;
        const height = tags.draw(ctx, plate, "plate", x, y);
        if (n !== speaker) continue;
        // 입구 안내 말풍선과 겹치면 안내가 먼저 (제목 말풍선은 쉰다)
        const bubble = titles.get(n.lot)!;
        const size = tags.size(bubble, "bubble");
        const bottom = y - height - 2;
        const underPrompt = shown !== null && Math.abs(x - promptX) < size.width / 2 + promptHalf && bottom > promptY - promptHeight && bottom - size.height < promptY;
        if (!underPrompt && !underHud(x, bottom, size)) tags.draw(ctx, bubble, "bubble", x, bottom);
      }
      tags.draw(ctx, name, "player", pos.x - camera.x, pos.y - camera.y - PLAYER_SIZE);
      lastPos.current = { from, pos };
      if (frame++ % 3 === 0) {
        canvas.dataset.feet = `${Math.round(pos.x)},${Math.round(pos.y)}`;
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
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("pointerdown", onPointer);
      canvas.removeEventListener("pointermove", onHover);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("bv-teleport", onTeleport);
      delete canvas.dataset.ready;
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
