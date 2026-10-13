import type { Metadata } from "next";
import Link from "next/link";
import { SalonStudio } from "@/components/salon/SalonStudio";
import { formatNumber } from "@/lib/game";
import { requireMember } from "@/server/dal";
import { getSalon } from "@/server/salon";

export const metadata: Metadata = { title: "반짝 미용실 | Blogville" };

// 미용실 (SHOP-07, specs/052-salon): 거울로 머리 모양·머리 색을 골라 보고, 안 가진 것만 한 번에 사서 바꾼다.
export default async function SalonPage() {
  const member = await requireMember();
  const salon = await getSalon(member.userId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">💇 반짝 미용실</h1>
          <p className="mt-1 text-ink-soft">거울 앞에서 머리 모양과 색을 골라 보고, 마음에 들면 한 번에 바꿔요.</p>
        </div>
        <Link href="/wallet" className="rounded-2xl border border-line bg-surface px-4 py-2 font-bold" data-salon-wallet>
          Lv.{salon.level} 🪙 {formatNumber(salon.coins)}
        </Link>
      </div>
      {salon.character ? (
        <SalonStudio character={salon.character} worn={salon.outfit} catalog={salon.catalog} current={salon.current} level={salon.level} coins={salon.coins} />
      ) : (
        <p className="rounded-2xl border border-line bg-surface p-6 text-center text-ink-soft">캐릭터가 있어야 머리를 바꿀 수 있어요.</p>
      )}
      <p className="text-sm text-ink-soft">
        옷은{" "}
        <Link href="/clothes" className="font-semibold text-accent underline">
          👗 옷가게
        </Link>
        에서 입어 볼 수 있어요.
      </p>
    </div>
  );
}
