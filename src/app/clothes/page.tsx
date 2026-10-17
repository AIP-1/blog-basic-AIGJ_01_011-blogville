import type { Metadata } from "next";
import Link from "next/link";
import { ClothesStudio } from "@/components/clothes/ClothesStudio";
import { GamePageShell } from "@/components/game/GamePageShell";
import { clothesShopArt } from "@/lib/art/town";
import { requireMember } from "@/server/dal";
import { getClothesShop } from "@/server/clothes";

export const metadata: Metadata = { title: "꼬까 옷가게 | Blogville" };

// 옷가게 (SHOP-08, specs/051-clothes-shop): 거울로 미리 입어 보고, 안 가진 것만 한 번에 사서 입는다.
export default async function ClothesPage() {
  const member = await requireMember();
  const shop = await getClothesShop(member.userId);

  return (
    <GamePageShell
      room="clothes"
      art={clothesShopArt()}
      description="거울 앞에서 마음껏 입어 보고, 마음에 들면 한 번에 사서 입어요."
      wallet={{ level: shop.level, coins: shop.coins, hook: "clothes" }}
    >
      {shop.character ? (
        <ClothesStudio character={shop.character} style={shop.style} catalog={shop.catalog} current={shop.current} level={shop.level} coins={shop.coins} />
      ) : (
        <p className="px-tile p-6 text-center text-ink-soft">캐릭터가 있어야 옷을 입어 볼 수 있어요.</p>
      )}
      <p className="mt-6 text-sm text-ink-soft">
        가진 옷은{" "}
        <Link href="/closet" className="font-semibold text-accent underline">
          🎨 꾸미기
        </Link>
        에서도 갈아입을 수 있어요.
      </p>
    </GamePageShell>
  );
}
