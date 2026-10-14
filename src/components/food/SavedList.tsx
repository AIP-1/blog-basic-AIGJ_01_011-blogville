import Link from "next/link";
import type { FoodPlace } from "@/lib/food";
import { reviewWriteHref } from "@/lib/food";
import { SaveButton } from "./SaveButton";

/** 🍽 ⭐ 가고 싶은 곳 탭: 내가 담은 식당 목록 (최근 담은 순) */
export function SavedList({ places }: { places: FoodPlace[] }) {
  if (places.length === 0) {
    return (
      <p className="rounded-lg border border-line p-6 text-center text-ink-soft" data-food-saved-empty>
        아직 담은 곳이 없어요. 식당 카드의 ☆ 가고 싶어요를 눌러 보세요.
      </p>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2" data-food-saved-list>
      {places.map((p) => (
        <li key={p.id} className="rounded-lg border border-line p-4" data-food-saved-item>
          <p className="font-semibold">{p.name}</p>
          {p.category && <p className="text-sm text-ink-soft">{p.category}</p>}
          {p.address && <p className="mt-1 text-sm">📍 {p.address}</p>}
          {p.phone && <p className="text-sm">📞 {p.phone}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SaveButton place={p} saved />
            {p.mapUrl && (
              <a href={p.mapUrl} target="_blank" rel="noopener noreferrer" className="btn">
                🗺 지도
              </a>
            )}
            <Link href={reviewWriteHref(p)} className="btn">
              ✍ 후기 쓰기
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
