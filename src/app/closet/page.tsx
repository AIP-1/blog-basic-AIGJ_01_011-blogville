import type { Metadata } from "next";
import Link from "next/link";
import { ClosetView } from "@/components/closet/ClosetView";
import { formatNumber } from "@/lib/game";
import { requireMember } from "@/server/dal";
import { getCloset } from "@/server/items";
import { getWallet } from "@/server/points";

export const metadata: Metadata = { title: "꾸미기 | Blogville" };

// 꾸미기 (SHOP-04·06): 가진 배경을 미니룸에 걸고, 모자·옷·소품을 내 캐릭터에 입힌다.
export default async function ClosetPage() {
  const member = await requireMember();
  const [closet, wallet] = await Promise.all([getCloset(member.userId), getWallet(member.userId)]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">🎨 꾸미기</h1>
          <p className="mt-1 text-ink-soft">고르면 바로 내 블로그 미니룸과 캐릭터에 적용돼요.</p>
        </div>
        <Link href="/wallet" className="rounded-2xl border border-line bg-surface px-4 py-2 font-bold">
          Lv.{wallet.progress.level} 🪙 {formatNumber(wallet.coin)}
          <span className="block text-xs font-normal text-ink-soft">경험치·코인 내역 보기</span>
        </Link>
      </div>
      <ClosetView character={closet.character} nickname={closet.nickname} avatar={closet.avatar} backgrounds={closet.backgrounds} furniture={closet.furniture} />
      <p className="text-sm text-ink-soft">
        더 많은 꾸미기 아이템과 배경은{" "}
        <Link href="/shop" className="font-semibold text-accent underline">
          🏪 상점
        </Link>
        에서 만날 수 있어요.
      </p>
    </div>
  );
}
