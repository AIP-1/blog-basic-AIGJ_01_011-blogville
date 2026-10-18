import Link from "next/link";
import type { CSSProperties } from "react";
import { PixelArtSvg } from "@/components/game/PixelArtSvg";
import { artCells, pixelPaths } from "@/lib/art/paths";
import { lanternArt } from "@/lib/art/town";
import { DIORAMA_PAD, dioramaScene, LANTERN_SIZE, warmGlow, type DioramaLantern, type Placed } from "@/lib/town/diorama";
import { seasonAt, type Season } from "@/lib/town/season";
import { lampsOn, type Sky } from "@/lib/town/sky";

/** 마을 그림 한 칸에 서는 집: 단계(1~10)·지붕 색·아래 글씨, 불 켜진 집이면 `fresh` */
export type DioramaHouse = {
  stage: number;
  roof: string;
  caption?: string;
  fresh?: boolean;
  /** 글씨 위 작은 줄 (예: `Lv.20`) */
  sub?: string;
  /** 내 집이면 우체통이 파랗다 (광장과 같음) */
  mine?: boolean;
  /** 집 그림과 이름을 한 링크로 (휴대폰 광장: `/@{slug}`) */
  href?: string;
};

/** 줄등 줄 색 (마을 잉크) */
const STRING_INK = "#3b2a20";

/** 칸 좌표 그림 한 장을 그대로 (그림 전체 viewBox 안에서 1칸 = 1) */
function Layer({ x, y, art }: Placed) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {pixelPaths([art]).map((p, i) => (
        <path key={i} d={p.d} fill={p.fill} />
      ))}
    </g>
  );
}

function GlowLayer({ x, y, art, opacity }: Placed & { opacity: number }) {
  return (
    <g transform={`translate(${x} ${y})`} fillOpacity={opacity}>
      {pixelPaths([art]).map((p, i) => (
        <path key={i} d={p.d} fill={p.fill} />
      ))}
    </g>
  );
}

/** 줄등에 매단 소형 초롱 하나 (world의 lanternArt 's'를 5×8칸 자리에 맞춘다). 켜진 초롱은 노을·밤에 옅은 빛 무리 */
function Lantern({ lantern, glow }: { lantern: DioramaLantern; glow: boolean }) {
  const art = lanternArt(lantern.lit, "s");
  const { width, height } = artCells(art);
  const cx = lantern.x + LANTERN_SIZE.width / 2;
  return (
    <g data-lantern data-lit={lantern.lit ? "1" : "0"}>
      <line x1={cx} y1={lantern.y - 1} x2={cx} y2={lantern.y} stroke={STRING_INK} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {lantern.lit && glow && (
        <>
          {warmGlow(cx, lantern.y + LANTERN_SIZE.height / 2, [0, 3, 4, 6]).map((g, i) => (
            <GlowLayer key={i} {...g} />
          ))}
        </>
      )}
      <svg x={lantern.x} y={lantern.y} width={LANTERN_SIZE.width} height={LANTERN_SIZE.height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMin meet" overflow="visible">
        {pixelPaths([art]).map((p, i) => (
          <path key={i} d={p.d} fill={p.fill} />
        ))}
      </svg>
    </g>
  );
}

/**
 * 작은 마을 그림 (광장 개편 "등불 마을"): 랜딩 첫 화면(집 1·3·6단계와 이름)과 휴대폰 광장 머리(내 집과 이웃 집)에 쓴다.
 * 게임 캔버스 없이 SVG 도트로 그린다: 하늘(한국 시각의 새벽·낮·노을·밤) → 먼 산·언덕·흙길 → 집 → 빛 → 우체통·가로등.
 * 24시간 안에 글을 쓴 집(`fresh`)은 창에 불이 켜지고 굴뚝 연기(움직임 줄이기면 멈춘 한 장)·우체통 깃발이 오른다.
 * 칸 하나는 `cell`px(정수)로 그리고, 자리가 좁으면 그림째 줄인다(가로 넘침 없음). 글씨는 Pretendard(갈무리 글꼴을 받지 않게).
 * 계절(`season`, 없으면 한국 시각의 지금 계절)에 맞춰 땅·나무 색을 바꾼다 (광장 캔버스와 같은 seasonAt).
 * `lanterns`면 집 위에 줄등을 걸고 집마다 소형 초롱을 단다(글 쓴 집은 켜진다). 집에 `href`가 있으면 집 그림과 이름이 한 링크다.
 * 시험 훅 `data-village-diorama`(집 수)·`data-sky`·`data-season`·`data-lit`(불 켜진 집 수)·`[data-lantern][data-lit]`·`[data-diorama-house]`.
 */
export function VillageDiorama({
  houses,
  sky = "dusk",
  label,
  className = "",
  cell = 3,
  season,
  lanterns = false,
}: {
  houses: readonly DioramaHouse[];
  sky?: Sky;
  /** 그림 전체의 설명 (화면 낭독기) */
  label: string;
  className?: string;
  /** 칸 하나의 최대 px (정수). 자리가 넓으면 이 크기에서 멈춘다 */
  cell?: number;
  /** 계절 팔레트. 없으면 지금 계절 */
  season?: Season | null;
  /** 집 위 줄등과 소형 초롱 */
  lanterns?: boolean;
}) {
  const now = season ?? seasonAt(new Date());
  const scene = dioramaScene(houses, sky, { season: now, lanterns });
  const shown = houses.slice(0, scene.houses.length);
  const lit = scene.houses.filter((h) => h.lit).length;
  const captions = shown.some((h) => h.caption || h.sub);
  const linked = shown.some((h) => h.href);
  return (
    <div
      {...(linked ? { role: "group" } : { role: "img" })}
      aria-label={label}
      className={className}
      data-village-diorama={houses.length}
      data-sky={sky}
      data-season={now}
      data-lit={lit}
    >
      <div className="village-diorama relative" style={{ maxWidth: scene.width * cell, containerType: "inline-size" } as CSSProperties}>
        <svg viewBox={`0 0 ${scene.width} ${scene.height}`} width={scene.width * cell} height={scene.height * cell} shapeRendering="crispEdges" className="village-diorama-scene" {...(linked ? { role: "img", "aria-label": label } : { "aria-hidden": true })}>
          <Layer x={0} y={0} art={scene.backdrop} />
          {scene.back.map((p, i) => (
            <Layer key={`b${i}`} {...p} />
          ))}
          {scene.houses.map((h, i) => (
            <g key={`h${i}`}>
              {h.smoke && (
                <g className="village-smoke">
                  {h.smoke.map((s, f) => (
                    <g key={f} className="village-smoke-frame" data-frame={f}>
                      <Layer {...s} />
                    </g>
                  ))}
                </g>
              )}
              <g transform={`translate(${h.x} ${h.y})`}>
                <PixelArtSvg art={h.art} cell={1} />
              </g>
            </g>
          ))}
          {scene.glows.map((g, i) => (
            <GlowLayer key={`g${i}`} {...g} />
          ))}
          {scene.front.map((p, i) => (
            <Layer key={`f${i}`} {...p} />
          ))}
          {scene.string && (
            <g data-lantern-string>
              <path
                d={`M0 ${scene.string.y} Q ${scene.width / 2} ${scene.string.y + scene.string.sag * 2} ${scene.width} ${scene.string.y}`}
                fill="none"
                stroke={STRING_INK}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                shapeRendering="geometricPrecision"
              />
              {scene.string.lanterns.map((l, i) => (
                <Lantern key={i} lantern={l} glow={lampsOn(sky)} />
              ))}
            </g>
          )}
        </svg>
        {linked ? (
          // 집 그림 + 이름이 한 링크: 이름 칸(44px 이상)이 링크고, 그 위로 집 그림 높이만큼 누를 자리를 넓힌다 (cqw = 그림 폭 기준)
          <div
            className="village-diorama-captions"
            style={{ paddingInline: `${(DIORAMA_PAD / scene.width) * 100}%`, gridTemplateColumns: `repeat(${scene.houses.length}, minmax(0, 1fr))` } as CSSProperties}
          >
            {shown.map((h, i) => {
              const placed = scene.houses[i];
              const reach = ((scene.height - placed.y) / scene.width) * 100;
              const body = (
                <>
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-full" style={{ height: `${reach}cqw` } as CSSProperties} />
                  {h.sub && <span className="village-diorama-sub">{h.sub}</span>}
                  {h.caption && <span className="px-font block w-full truncate">{h.caption}</span>}
                </>
              );
              return h.href ? (
                <Link
                  key={i}
                  href={h.href}
                  className="village-diorama-caption relative flex min-h-11 w-full min-w-0 flex-col items-center justify-center rounded-sm active:translate-y-px active:bg-(--kit-paper-2) [&:active>span:first-child]:bg-black/10"
                  data-diorama-house
                  aria-label={h.caption ? `${h.caption}${h.mine ? "" : " 블로그"}` : undefined}
                >
                  {body}
                </Link>
              ) : (
                <span key={i} className="village-diorama-caption relative">
                  {body}
                </span>
              );
            })}
          </div>
        ) : captions && (
          // 집 가운데에 맞춘 글씨 줄 (그림과 같은 비율로 양끝을 띄운다)
          <div
            className="village-diorama-captions"
            style={{ paddingInline: `${(DIORAMA_PAD / scene.width) * 100}%`, gridTemplateColumns: `repeat(${scene.houses.length}, minmax(0, 1fr))` } as CSSProperties}
          >
            {shown.map((h, i) => (
              <span key={i} className="village-diorama-caption">
                {h.sub && <span className="village-diorama-sub">{h.sub}</span>}
                {h.caption && <span className="block truncate">{h.caption}</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
