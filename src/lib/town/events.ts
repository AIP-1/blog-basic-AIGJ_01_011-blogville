// 마을 게임(캔버스)과 화면 위 메뉴(HUD)가 주고받는 이벤트 (광장 개편). 서로의 파일을 고치지 않고 이 이름과 모양만 맞춘다.
// 원래 있던 셋(bv-teleport·bv-mailbox·bv-lots)의 이름과 모양은 시험이 쓰니 그대로 둔다.

import type { Point } from "./layout";
import type { Zone } from "./zones";

export type TownEvents = {
  /** HUD → 게임 캔버스(`[data-town] canvas`에 보냄): 그 자리로 순간 이동 (TOWN-02) */
  "bv-teleport": Point;
  /** 게임 → window: 우체통 입구나 걷는 이웃을 눌렀다 (TOWN-13·19) */
  "bv-mailbox": { lot: number };
  /** 게임 → window: 내 마을 빈 집터 입구 (TOWN-18) */
  "bv-lots": { lot: number };
  /** HUD → window: 안 읽은 알림이 생기거나 없어졌다. 게임은 내 우체통 깃발만 다시 그린다(게임을 다시 만들지 않음) */
  "bv-mail": { flag: boolean };
  /** 게임 → window: 내가 선 구역이 바뀌었다 (HUD 장소 간판) */
  "bv-zone": { zone: Zone };
  /** HUD → window: 창(패널)이 열리거나 닫혔다. 열리면 게임은 멀리서 누른 건물에 걸어가 들어가기를 그만둔다 (창을 읽는 동안 화면이 넘어가지 않게) */
  "bv-panel": { open: boolean };
  /** HUD·터치 [들어가기] 버튼 → window: 지금 가까운 입구로 들어간다 (Space와 같음) */
  "bv-enter": Record<string, never>;
};

export type TownEventName = keyof TownEvents;

/** window에 마을 이벤트를 보낸다 (`bv-teleport`만 캔버스에 보낸다: `teleportTo`) */
export function emitTown<K extends Exclude<TownEventName, "bv-teleport">>(name: K, detail: TownEvents[K]): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

/** window의 마을 이벤트를 듣는다. 돌려준 함수로 그만 듣는다 */
export function onTown<K extends Exclude<TownEventName, "bv-teleport">>(name: K, listener: (detail: TownEvents[K]) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<TownEvents[K]>).detail);
  window.addEventListener(name, handler);
  return () => window.removeEventListener(name, handler);
}

/** 게임 캔버스에 순간 이동을 알린다 (TOWN-02) */
export function teleportTo(spot: Point): void {
  document.querySelector("[data-town] canvas")?.dispatchEvent(new CustomEvent("bv-teleport", { detail: { x: spot.x, y: spot.y } }));
}
