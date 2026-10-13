import type { Metadata } from "next";
import Link from "next/link";
import { FarmView } from "@/components/farm/FarmView";
import { formatNumber } from "@/lib/game";
import { requireMember } from "@/server/dal";
import { getFarm } from "@/server/farm";

export const metadata: Metadata = { title: "동물 농장 | Blogville" };

// 동물 농장 (TOWN-09): 알을 받아 부화시키고 하루 한 번씩 돌봐 키운다. 다 키우면 보상과 카드.
export default async function FarmPage() {
  const member = await requireMember();
  const farm = await getFarm(member.userId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">🐮 동물 농장</h1>
          <p className="mt-1 text-ink-soft">알을 부화시키고 밥·물·쓰다듬기로 돌봐 주세요. 공개 글을 쓰면 동물들도 함께 자라요.</p>
        </div>
        <Link href="/wallet" className="rounded-2xl border border-line bg-surface px-4 py-2 font-bold" data-farm-wallet>
          Lv.{farm.level} 🪙 {formatNumber(farm.coins)}
        </Link>
      </div>
      <FarmView farm={farm} />
    </div>
  );
}
