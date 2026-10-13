import type { Metadata } from "next";
import Link from "next/link";
import { ShopView } from "@/components/shop/ShopView";
import { formatNumber } from "@/lib/game";
import { getMyBlog, requireMember } from "@/server/dal";
import { getWallet } from "@/server/points";
import { listShopItems } from "@/server/shop";

export const metadata: Metadata = { title: "마을 상점 | Blogville" };

// 마을 상점 (SHOP-01·02·03): 아바타 꾸미기·가구·배경을 코인으로 산다. 기본 아이템과 캐릭터는 팔지 않는다.
export default async function ShopPage() {
  const member = await requireMember();
  const [items, wallet, blog] = await Promise.all([listShopItems(member.userId), getWallet(member.userId), getMyBlog(member.userId)]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">🏪 마을 상점</h1>
          <p className="mt-1 text-ink-soft">글을 쓰고 출석해서 모은 코인으로 내 캐릭터와 미니룸을 꾸며 보세요.</p>
          <p className="mt-1 text-sm text-ink-soft">
            요리사 옷·한복·갑옷 같은 새 옷과 모자는{" "}
            <Link href="/clothes" className="font-semibold text-accent underline">
              👗 옷가게
            </Link>
            에서 거울로 입어 보고 살 수 있어요.
          </p>
        </div>
        <Link href="/wallet" className="rounded-2xl border border-line bg-surface px-4 py-2 font-bold" data-shop-wallet>
          Lv.{wallet.progress.level} 🪙 {formatNumber(wallet.coin)}
        </Link>
      </div>
      <ShopView items={items} level={wallet.progress.level} coins={wallet.coin} mySlug={blog.slug} />
    </div>
  );
}
