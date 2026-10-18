"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { parseHostSlug, townReturnHref, type ReturnSpot } from "@/lib/town/zones";

/**
 * 게임 화면의 [🚪 광장으로] (plaza-upgrade-2 C4). 친구 마을에서 들어와 주소에 `?host={블로그 주소}`가 붙어 있으면
 * 그 친구 마을의 같은 문 앞으로 돌아간다. 상점·옷가게·미용실처럼 화면은 내 것인 곳도 돌아가는 길만 이어 받는다.
 */
export function RoomExitLink({ spot, host }: { spot: ReturnSpot | null; host?: string }) {
  const params = useSearchParams();
  const back = host ?? parseHostSlug(params.get("host")) ?? undefined;
  return (
    <Link href={townReturnHref(spot, back)} className="px-btn px-btn--sm" data-room-exit>
      🚪 광장으로
    </Link>
  );
}
