import type { Metadata } from "next";
import Link from "next/link";
import { ClothesStudio } from "@/components/clothes/ClothesStudio";
import { formatNumber } from "@/lib/game";
import { requireMember } from "@/server/dal";
import { getClothesShop } from "@/server/clothes";

export const metadata: Metadata = { title: "꼬까 옷가게 | Blogville" };

// 옷가게 (SHOP-08, specs/051-clothes-shop): 거울로 미리 입어 보고, 안 가진 것만 한 번에 사서 입는다.
export default async function ClothesPage() {
  const member = await requireMember();
  const shop = await getClothesShop(member.userId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">👗 꼬까 옷가게</h1>
          <p className="mt-1 text-ink-soft">거울 앞에서 마음껏 입어 보고, 마음에 들면 한 번에 사서 입어요.</p>
        </div>
        <Link href="/wallet" className="rounded-2xl border border-line bg-surface px-4 py-2 font-bold" data-clothes-wallet>
          Lv.{shop.level} 🪙 {formatNumber(shop.coins)}
        </Link>
      </div>
      {shop.character ? (
        <ClothesStudio character={shop.character} catalog={shop.catalog} current={shop.current} level={shop.level} coins={shop.coins} />
      ) : (
        <p className="rounded-2xl border border-line bg-surface p-6 text-center text-ink-soft">캐릭터가 있어야 옷을 입어 볼 수 있어요.</p>
      )}
      <p className="text-sm text-ink-soft">
        가진 옷은{" "}
        <Link href="/closet" className="font-semibold text-accent underline">
          🎨 꾸미기
        </Link>
        에서도 갈아입을 수 있어요.
      </p>
    </div>
  );
}
