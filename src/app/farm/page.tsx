import type { Metadata } from "next";
import { FarmView } from "@/components/farm/FarmView";
import { GamePageShell } from "@/components/game/GamePageShell";
import { farmArt } from "@/lib/art/town";
import { requireMember } from "@/server/dal";
import { getFarm } from "@/server/farm";

export const metadata: Metadata = { title: "동물 농장 | Blogville" };

// 동물 농장 (TOWN-09): 알을 받아 부화시키고 하루 한 번씩 돌봐 키운다. 다 키우면 보상과 카드.
export default async function FarmPage() {
  const member = await requireMember();
  const farm = await getFarm(member.userId);

  return (
    <GamePageShell
      room="farm"
      art={farmArt()}
      description="알을 부화시키고 밥·물·쓰다듬기로 돌봐 주세요. 공개 글을 쓰면 동물들도 함께 자라요."
      wallet={{ level: farm.level, coins: farm.coins, hook: "farm" }}
    >
      <FarmView farm={farm} />
    </GamePageShell>
  );
}
