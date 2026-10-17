import type { PixelArt } from "./art/characters";
import { townReturnHref, type ReturnSpot } from "./town/zones";

// 마을 건물 안 화면 (광장 개편, GamePageShell): 간판 제목, 폭, 광장으로 나갈 때 돌아올 자리.
// 화면 제목(h1)의 글자는 `{이모지} {이름}` 그대로다. 이모지는 간판 그림이 대신해 눈에는 숨기지만 글자와 접근 이름에는 남긴다.

export type GameRoom = {
  emoji: string;
  title: string;
  /** 광장 어느 문 앞으로 돌아갈지. null이면 그냥 광장 (`/town`) */
  spot: ReturnSpot | null;
  /** wide 64rem(카드가 많은 가게), narrow 48rem(한 줄로 읽는 화면) */
  width: "wide" | "narrow";
};

export const GAME_ROOMS = {
  shop: { emoji: "🏪", title: "마을 상점", spot: "shop", width: "wide" },
  clothes: { emoji: "👗", title: "꼬까 옷가게", spot: "clothes", width: "wide" },
  salon: { emoji: "💇", title: "반짝 미용실", spot: "salon", width: "wide" },
  closet: { emoji: "🎨", title: "꾸미기", spot: null, width: "wide" },
  farm: { emoji: "🐮", title: "동물 농장", spot: "farm", width: "wide" },
  fishing: { emoji: "🎣", title: "연못 낚시터", spot: "pond", width: "narrow" },
  attendance: { emoji: "📮", title: "출석 체크", spot: "board", width: "narrow" },
  wallet: { emoji: "📒", title: "경험치·코인 내역", spot: null, width: "narrow" },
} as const satisfies Record<string, GameRoom>;

export type GameRoomKey = keyof typeof GAME_ROOMS;

/** h1의 글자 (textContent): 이모지 뒤 빈칸 하나까지 숨긴 칸에 들어간다 */
export function roomHeading(key: GameRoomKey): string {
  const room = GAME_ROOMS[key];
  return `${room.emoji} ${room.title}`;
}

/** [🚪 광장으로]가 가는 주소 */
export function roomExitHref(key: GameRoomKey): string {
  return townReturnHref(GAME_ROOMS[key].spot);
}

/**
 * 그림 둘레의 빈 칸(투명)을 잘라 낸다. 간판에는 건물만 남긴다
 * (집 그림은 다음 단계에 붙을 탑·정원 자리가 비어 있어 그대로 두면 한쪽으로 쏠려 보인다).
 */
export function trimArt(art: PixelArt): PixelArt {
  const filled = (ch: string | undefined) => ch !== undefined && ch !== "." && Boolean(art.palette[ch]);
  const rows = art.rows;
  let top = 0;
  let bottom = rows.length - 1;
  while (top < bottom && ![...rows[top]].some(filled)) top++;
  while (bottom > top && ![...rows[bottom]].some(filled)) bottom--;
  const kept = rows.slice(top, bottom + 1);
  const colFilled = (x: number) => kept.some((r) => filled(r[x]));
  let left = 0;
  let right = (rows[0]?.length ?? 0) - 1;
  while (left < right && !colFilled(left)) left++;
  while (right > left && !colFilled(right)) right--;
  return { ...art, rows: kept.map((r) => r.slice(left, right + 1)) };
}
