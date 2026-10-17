import type { Metadata } from "next";
import Link from "next/link";
import { ClosetView } from "@/components/closet/ClosetView";
import { GamePageShell } from "@/components/game/GamePageShell";
import { houseArt } from "@/lib/art/town";
import { houseStage } from "@/lib/house";
import { currentRoof, ROOF_HEX } from "@/lib/roof";
import { getMyBlog, requireMember } from "@/server/dal";
import { getCloset } from "@/server/items";
import { getWallet } from "@/server/points";

export const metadata: Metadata = { title: "꾸미기 | Blogville" };

// 꾸미기 (SHOP-04·06): 가진 배경을 미니룸에 걸고, 모자·옷·소품을 내 캐릭터에 입힌다. 간판은 광장에 선 내 집
export default async function ClosetPage() {
  const member = await requireMember();
  const [closet, wallet, blog] = await Promise.all([getCloset(member.userId), getWallet(member.userId), getMyBlog(member.userId)]);
  const level = wallet.progress.level;

  return (
    <GamePageShell
      room="closet"
      art={houseArt(houseStage(level), ROOF_HEX[currentRoof(blog.id, blog.roofColor)])}
      description="고르면 바로 내 블로그 미니룸과 캐릭터에 적용돼요."
      wallet={{ level, coins: wallet.coin }}
    >
      <ClosetView character={closet.character} nickname={closet.nickname} avatar={closet.avatar} backgrounds={closet.backgrounds} furniture={closet.furniture} />
      <p className="mt-6 text-sm text-ink-soft">
        더 많은 꾸미기 아이템과 배경은{" "}
        <Link href="/shop" className="font-semibold text-accent underline">
          🏪 상점
        </Link>
        에서 만날 수 있어요.
      </p>
    </GamePageShell>
  );
}
