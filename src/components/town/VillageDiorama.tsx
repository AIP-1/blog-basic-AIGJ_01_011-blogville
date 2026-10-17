import type { CSSProperties } from "react";
import { PixelArtSvg } from "@/components/game/PixelArtSvg";
import { pixelPaths } from "@/lib/art/paths";
import { DIORAMA_PAD, dioramaScene, type Placed } from "@/lib/town/diorama";
import type { Sky } from "@/lib/town/sky";

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
};

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

/**
 * 작은 마을 그림 (광장 개편 "등불 마을"): 랜딩 첫 화면(집 1·3·6단계와 이름)과 휴대폰 광장 머리(내 집과 이웃 집)에 쓴다.
 * 게임 캔버스 없이 SVG 도트로 그린다: 하늘(한국 시각의 새벽·낮·노을·밤) → 먼 산·언덕·흙길 → 집 → 빛 → 우체통·가로등.
 * 24시간 안에 글을 쓴 집(`fresh`)은 창에 불이 켜지고 굴뚝 연기(움직임 줄이기면 멈춘 한 장)·우체통 깃발이 오른다.
 * 칸 하나는 `cell`px(정수)로 그리고, 자리가 좁으면 그림째 줄인다(가로 넘침 없음). 글씨는 Pretendard(갈무리 글꼴을 받지 않게).
 * 시험 훅 `data-village-diorama`(집 수)·`data-sky`·`data-lit`(불 켜진 집 수).
 */
export function VillageDiorama({
  houses,
  sky = "dusk",
  label,
  className = "",
  cell = 3,
}: {
  houses: readonly DioramaHouse[];
  sky?: Sky;
  /** 그림 전체의 설명 (화면 낭독기) */
  label: string;
  className?: string;
  /** 칸 하나의 최대 px (정수). 자리가 넓으면 이 크기에서 멈춘다 */
  cell?: number;
}) {
  const scene = dioramaScene(houses, sky);
  const shown = houses.slice(0, scene.houses.length);
  const lit = scene.houses.filter((h) => h.lit).length;
  const captions = shown.some((h) => h.caption || h.sub);
  return (
    <div role="img" aria-label={label} className={className} data-village-diorama={houses.length} data-sky={sky} data-lit={lit}>
      <div className="village-diorama" style={{ maxWidth: scene.width * cell } as CSSProperties}>
        <svg viewBox={`0 0 ${scene.width} ${scene.height}`} width={scene.width * cell} height={scene.height * cell} shapeRendering="crispEdges" aria-hidden="true" className="village-diorama-scene">
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
        </svg>
        {captions && (
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
