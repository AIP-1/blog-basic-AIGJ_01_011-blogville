// 클릭 이동 길찾기와 모서리 미끄러지기 (광장 개편 2, A1). 게임 화면(TownGame)과 단위 시험이 같이 쓴다.
// 발 상자(`FEET`)가 몸체(`bodies`)에 닿지 않는 칸을 20px 격자로 보고 A*로 길을 찾은 뒤, 곧게 보이는 점은 건너뛰어 꺾이는 점만 남긴다.
import { FEET, step, WORLD, type Point, type Rect } from "./layout";

/** 길찾기 격자 한 칸 (px) */
export const PATH_CELL = 20;
/** 막힘을 미리 그려 두는 고운 격자 한 칸 (px). 곧은 줄 보기(가시선)는 이 칸으로 본다 */
const FINE = 5;
/** 고운 격자가 반올림으로 놓치지 않게 몸체를 이만큼 넓게 본다 (px) */
const MARGIN = 3;
/** 키보드로 몸체에 막혔을 때 옆으로 비켜 갈 수 있는 거리 (px): 이보다 멀면 그냥 멈춘다 */
export const SLIDE_REACH = 32;

/**
 * 걸을 수 있는 땅 지도: 발밑 점마다 발 상자가 몸체·마을 밖에 닿는지 고운 격자(5px)로 한 번 그려 둔다.
 * 몸체가 바뀌지 않는 한 게임 하나에 하나만 만든다.
 */
export class WalkGrid {
  private readonly cols = Math.ceil(WORLD.width / FINE);
  private readonly rows = Math.ceil(WORLD.height / FINE);
  private readonly blocked: Uint8Array;

  constructor(readonly bodies: readonly Rect[]) {
    this.blocked = new Uint8Array(this.cols * this.rows);
    const half = FEET.width / 2;
    const mark = (x0: number, y0: number, x1: number, y1: number) => {
      const c0 = Math.max(0, Math.floor(x0 / FINE));
      const c1 = Math.min(this.cols - 1, Math.floor(x1 / FINE));
      const r0 = Math.max(0, Math.floor(y0 / FINE));
      const r1 = Math.min(this.rows - 1, Math.floor(y1 / FINE));
      for (let r = r0; r <= r1; r++) this.blocked.fill(1, r * this.cols + c0, r * this.cols + c1 + 1);
    };
    // 발밑 점 (x, y)의 발 상자 [x-14, x+14] × [y-16, y]가 몸체와 겹치는 발밑 자리
    for (const b of bodies) mark(b.x - half - MARGIN, b.y - MARGIN, b.x + b.width + half + MARGIN, b.y + b.height + FEET.height + MARGIN);
    // 마을 가장자리
    mark(0, 0, half + MARGIN, WORLD.height);
    mark(WORLD.width - half - MARGIN, 0, WORLD.width, WORLD.height);
    mark(0, 0, WORLD.width, FEET.height + MARGIN);
  }

  /** 발밑이 그 점이면 걸을 수 있는가 (고운 격자 기준, 몸체를 3px 넓게 본다) */
  free(p: Point): boolean {
    const c = Math.floor(p.x / FINE);
    const r = Math.floor(p.y / FINE);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return false;
    return this.blocked[r * this.cols + c] === 0;
  }

  /** 두 점 사이를 곧게 걸을 수 있는가 (2.5px마다 본다) */
  clear(a: Point, b: Point): boolean {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (FINE / 2)));
    for (let i = 1; i <= n; i++) if (!this.free({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n })) return false;
    return true;
  }

  /**
   * `from`에서 `to`까지 걸을 길: 꺾이는 점 목록 (첫 점은 `from` 다음, 끝 점은 도착 자리).
   * 목표가 막힌 자리면 가장 가까운 빈 칸까지. 길이 없으면 null. 이미 닿아 있으면 빈 목록.
   */
  find(from: Point, to: Point): Point[] | null {
    const W = Math.ceil(WORLD.width / PATH_CELL);
    const H = Math.ceil(WORLD.height / PATH_CELL);
    const center = (i: number): Point => ({ x: (i % W) * PATH_CELL + PATH_CELL / 2, y: Math.floor(i / W) * PATH_CELL + PATH_CELL / 2 });
    const cellOf = (p: Point) => Math.min(H - 1, Math.max(0, Math.floor(p.y / PATH_CELL))) * W + Math.min(W - 1, Math.max(0, Math.floor(p.x / PATH_CELL)));
    const open = (i: number) => this.free(center(i));

    // 도착 자리: 목표가 걸을 수 있는 땅이면 그대로, 아니면 가까운 빈 칸 (넓혀 가며 찾는다)
    let goalPoint: Point = to;
    let goal = cellOf(to);
    if (!this.free(to)) {
      const found = this.nearestOpen(goal, W, H, open);
      if (found < 0) return null;
      goal = found;
      goalPoint = center(found);
    }
    if (this.clear(from, goalPoint)) return Math.hypot(goalPoint.x - from.x, goalPoint.y - from.y) < 1 ? [] : [goalPoint];

    // 출발 칸: 서 있는 칸 가운데가 막혔으면 곧게 닿는 가까운 빈 칸에서
    let start = cellOf(from);
    if (!open(start)) {
      const found = this.nearestOpen(start, W, H, (i) => open(i) && this.clear(from, center(i)));
      if (found < 0) return null;
      start = found;
    }

    // A* (8방향, 모서리를 깎아 지나가지 않는다)
    const g = new Float64Array(W * H).fill(Infinity);
    const came = new Int32Array(W * H).fill(-1);
    const closed = new Uint8Array(W * H);
    const heap = new MinHeap();
    const h = (i: number) => {
      const dx = Math.abs((i % W) - (goal % W));
      const dy = Math.abs(Math.floor(i / W) - Math.floor(goal / W));
      return (dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy)) * PATH_CELL;
    };
    g[start] = 0;
    heap.push(start, h(start));
    let reached = false;
    while (heap.size > 0) {
      const cur = heap.pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === goal) {
        reached = true;
        break;
      }
      const cx = cur % W;
      const cy = Math.floor(cur / W);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = ny * W + nx;
          if (closed[n] || !open(n)) continue;
          if (dx !== 0 && dy !== 0 && (!open(cy * W + nx) || !open(ny * W + cx))) continue;
          const cost = g[cur] + (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1) * PATH_CELL;
          if (cost < g[n]) {
            g[n] = cost;
            came[n] = cur;
            heap.push(n, cost + h(n));
          }
        }
    }
    if (!reached) return null;
    const cells: Point[] = [];
    for (let i = goal; i !== start && i >= 0; i = came[i]) cells.push(center(i));
    cells.push(center(start));
    cells.reverse();
    cells[cells.length - 1] = goalPoint;
    return this.smooth(from, cells);
  }

  /** 곧게 갈 수 있는 점은 건너뛴다: 지금 자리에서 보이는 가장 먼 점으로 */
  private smooth(from: Point, points: Point[]): Point[] {
    const out: Point[] = [];
    let at = from;
    let i = 0;
    while (i < points.length) {
      let far = i;
      for (let j = points.length - 1; j > i; j--) {
        if (this.clear(at, points[j])) {
          far = j;
          break;
        }
      }
      at = points[far];
      out.push(at);
      i = far + 1;
    }
    return out;
  }

  /** `cell`에서 넓혀 가며 가장 가까운 빈 칸 (없으면 -1) */
  private nearestOpen(cell: number, W: number, H: number, ok: (i: number) => boolean): number {
    const cx = cell % W;
    const cy = Math.floor(cell / W);
    for (let r = 0; r < Math.max(W, H); r++) {
      let best = -1;
      let bestD = Infinity;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const i = y * W + x;
          const d = dx * dx + dy * dy;
          if (d < bestD && ok(i)) {
            best = i;
            bestD = d;
          }
        }
      if (best >= 0) return best;
    }
    return -1;
  }
}

/** 몸체를 피해 `from`에서 `to`까지 걷는 길 (`WalkGrid.find`). 길이 없으면 null */
export function findPath(bodies: readonly Rect[], from: Point, to: Point): Point[] | null {
  return new WalkGrid(bodies).find(from, to);
}

/** 발 상자가 몸체·마을 밖에 닿는가 (layout.step과 같은 규칙) */
function blockedAt(p: Point, bodies: readonly Rect[]): boolean {
  const half = FEET.width / 2;
  const x = p.x - half;
  const y = p.y - FEET.height;
  if (x < 0 || y < 0 || x + FEET.width > WORLD.width || p.y > WORLD.height) return true;
  for (const b of bodies) if (x < b.x + b.width && b.x < x + FEET.width && y < b.y + b.height && b.y < p.y) return true;
  return false;
}

/**
 * 한 걸음 (키보드): `step`처럼 축마다 미끄러지고, 한 방향(↑·↓·←·→)으로 밀다 몸체 모서리에 걸리면
 * 계단 모서리처럼 옆으로 비켜 선다. 비켜 설 곳이 `SLIDE_REACH`보다 멀면 그냥 멈춘다 (가운데에서 밀면 막힌다).
 */
export function slideStep(from: Point, delta: Point, bodies: readonly Rect[]): Point {
  const next = step(from, delta, bodies);
  const alongX = delta.y === 0 && delta.x !== 0;
  const alongY = delta.x === 0 && delta.y !== 0;
  if (!alongX && !alongY) return next;
  const moved = alongX ? Math.abs(next.x - from.x) : Math.abs(next.y - from.y);
  if (moved > 0.01) return next;
  const reach = Math.hypot(delta.x, delta.y);
  const dir = { x: Math.sign(delta.x), y: Math.sign(delta.y) };
  // 몸체까지 남은 틈이 한 걸음보다 짧으면 먼저 닿을 때까지 (1px씩)
  let close = from;
  for (let k = 1; k <= Math.floor(reach); k++) {
    const p = { x: from.x + dir.x * k, y: from.y + dir.y * k };
    if (blockedAt(p, bodies)) break;
    close = p;
  }
  if (close !== from) return close;
  const side = { x: dir.y !== 0 ? 1 : 0, y: dir.x !== 0 ? 1 : 0 };
  // 가장 가까운 비켜 설 자리: 옆으로 s만큼 옮기면 앞으로 한 칸 나아갈 수 있다 (옆으로 가는 길도 비어 있어야)
  for (let s = 1; s <= SLIDE_REACH; s++) {
    for (const sign of [1, -1]) {
      const p = { x: from.x + side.x * s * sign, y: from.y + side.y * s * sign };
      if (blockedAt(p, bodies)) continue;
      if (blockedAt({ x: p.x + dir.x, y: p.y + dir.y }, bodies)) continue;
      let ok = true;
      for (let k = 1; k < s && ok; k++) if (blockedAt({ x: from.x + side.x * k * sign, y: from.y + side.y * k * sign }, bodies)) ok = false;
      if (!ok) continue;
      const m = Math.min(reach, s);
      return { x: from.x + side.x * m * sign, y: from.y + side.y * m * sign };
    }
  }
  return next;
}

/** 작은 우선순위 큐 (A* 열린 목록) */
class MinHeap {
  private readonly keys: number[] = [];
  private readonly items: number[] = [];
  get size(): number {
    return this.items.length;
  }
  push(item: number, key: number): void {
    const { keys, items } = this;
    let i = items.length;
    items.push(item);
    keys.push(key);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (keys[parent] <= keys[i]) break;
      [keys[parent], keys[i]] = [keys[i], keys[parent]];
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop(): number {
    const { keys, items } = this;
    const top = items[0];
    const lastItem = items.pop()!;
    const lastKey = keys.pop()!;
    if (items.length > 0) {
      items[0] = lastItem;
      keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && keys[l] < keys[m]) m = l;
        if (r < items.length && keys[r] < keys[m]) m = r;
        if (m === i) break;
        [keys[m], keys[i]] = [keys[i], keys[m]];
        [items[m], items[i]] = [items[i], items[m]];
        i = m;
      }
    }
    return top;
  }
}
