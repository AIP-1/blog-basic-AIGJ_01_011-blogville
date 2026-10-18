import Link from "next/link";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import { PixelArtSvg } from "@/components/game/PixelArtSvg";
import type { PixelArt } from "@/lib/art/characters";
import { artCells } from "@/lib/art/paths";
import { formatNumber } from "@/lib/game";
import { GAME_ROOMS, trimArt, type GameRoom, type GameRoomKey } from "@/lib/game-rooms";
import { townReturnHref } from "@/lib/town/zones";
import { RoomExitLink } from "./RoomExitLink";

/** 지갑 칩의 시험 훅 이름 (`data-shop-wallet` 등). 꾸미기·내역 화면은 훅 없이 */
type WalletHook = "shop" | "clothes" | "salon" | "farm";

/**
 * 마을 건물 안 화면의 공통 틀 (광장 개편). 위는 그 건물의 나무 간판 한 줄, 아래는 차분한 종이 한 장.
 * - 간판: 광장에서 본 건물 외관(도트 그림, 꾸밈이라 숨김)이 판자 위로 솟고, 제목은 갈무리 24px.
 *   제목 이모지는 그림이 대신하므로 눈에는 숨기고 글자·접근 이름에는 남긴다 (`🏪 마을 상점`).
 * - 지갑 칩(`Lv.1 🪙 110`, /wallet)과 [🚪 광장으로](그 건물 문 앞, `/town?from=`)는 늘 같은 자리.
 * - 종이 안에서는 사이트 색 토큰(--surface·--line·--ink…)을 종이 색으로 바꿔, 안쪽 화면이 따로 색을 몰라도 어울리게 한다.
 * - `room`은 GAME_ROOMS의 키, 또는 표에 없는 화면(📝 이번 주 글감)이면 그 간판 정보(`key`는 `data-room`).
 * - `host`(친구 마을 블로그 주소)가 있으면 [광장으로]는 그 친구 마을의 같은 문 앞(`/town/{host}?from=`)으로 (plaza-upgrade-2 C4).
 */
export function GamePageShell({
  room,
  art,
  description,
  wallet,
  host,
  children,
}: {
  room: GameRoomKey | (GameRoom & { key: string });
  art: PixelArt;
  description?: ReactNode;
  wallet?: { level: number; coins: number; hook?: WalletHook };
  host?: string;
  children: ReactNode;
}) {
  const info: GameRoom = typeof room === "string" ? GAME_ROOMS[room] : room;
  const roomKey = typeof room === "string" ? room : room.key;
  const sign = trimArt(art);
  // 휴대폰에서는 그림을 칸당 2px로 줄인다 (3px → 2px, 정수배라 도트가 또렷하다)
  const artStyle = { "--art-rows": artCells(sign).height } as CSSProperties;
  const hook = wallet?.hook ? { [`data-${wallet.hook}-wallet`]: "" } : {};

  return (
    <div className={`mx-auto w-full ${info.width === "narrow" ? "max-w-3xl" : "max-w-5xl"}`} data-room={roomKey}>
      <div className="px-plank px-sign">
        <span className="px-sign-art" style={artStyle}>
          <PixelArtSvg art={sign} cell={3} />
        </span>
        <div className="px-sign-title">
          <h1 className="px-font-2x px-sign-h1">
            <span className="sr-only">{info.emoji} </span>
            {info.title}
          </h1>
          {description && <p className="px-sign-lead">{description}</p>}
        </div>
        <div className="px-sign-tools">
          {wallet && (
            <Link href="/wallet" className="px-btn px-btn--sm px-wallet" title="경험치·코인 내역 보기" {...hook}>
              Lv.{wallet.level} 🪙 {formatNumber(wallet.coins)}
            </Link>
          )}
          <Suspense
            fallback={
              <Link href={townReturnHref(info.spot, host)} className="px-btn px-btn--sm" data-room-exit>
                🚪 광장으로
              </Link>
            }
          >
            <RoomExitLink spot={info.spot} host={host} />
          </Suspense>
        </div>
      </div>
      <div className="px-box px-room mt-5">{children}</div>
    </div>
  );
}
