import type { Sky } from "@/lib/town/sky";

/** 마을 그림 한 칸에 서는 집: 단계(1~10)·지붕 색·아래 글씨, 불 켜진 집이면 `fresh` */
export type DioramaHouse = { stage: number; roof: string; caption?: string; fresh?: boolean };

/**
 * 작은 마을 그림 (광장 개편): 랜딩 첫 화면(집 1·3·6단계와 이름)과 휴대폰 광장 머리(내 집과 이웃 집)에 쓴다.
 * 게임 캔버스 없이 SVG 도트로 그린다. 글씨는 Pretendard(갈무리 글꼴을 받지 않게). 시험 훅 `data-village-diorama`.
 * 1일차 계약: 서명만 정하고 그림은 사이트 작업(D)이 채운다.
 */
export function VillageDiorama({
  houses,
  sky = "dusk",
  label,
  className = "",
}: {
  houses: readonly DioramaHouse[];
  sky?: Sky;
  /** 그림 전체의 설명 (화면 낭독기) */
  label: string;
  className?: string;
}) {
  return <div role="img" aria-label={label} className={className} data-village-diorama={houses.length} data-sky={sky} />;
}
