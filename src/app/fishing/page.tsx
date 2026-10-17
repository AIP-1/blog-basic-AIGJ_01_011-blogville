import type { Metadata } from "next";
import { FishingView } from "@/components/fishing/FishingView";
import { GamePageShell } from "@/components/game/GamePageShell";
import { pondArt } from "@/lib/art/town";
import { requireMember } from "@/server/dal";
import { getFishing } from "@/server/fishing";

export const metadata: Metadata = { title: "연못 낚시터 | Blogville" };

// 연못 낚시터 (TOWN-14): 하루 한 번 낚싯대를 던져 코인이나 동물 먹이를 받는다.
export default async function FishingPage() {
  const member = await requireMember();
  const { today, recent } = await getFishing(member.userId);

  return (
    <GamePageShell
      room="fishing"
      art={pondArt()}
      description="하루에 한 번 낚싯대를 던질 수 있어요. 물고기를 낚으면 코인을, 먹이 꾸러미를 건지면 동물 농장에서 쓸 먹이를 받아요."
    >
      <FishingView today={today} recent={recent} />
    </GamePageShell>
  );
}
