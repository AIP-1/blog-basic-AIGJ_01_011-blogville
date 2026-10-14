import Link from "next/link";
import { buzzLabel, distanceLabel, FOOD_HOT, reviewWriteHref, type FoodPlace } from "@/lib/food";

/** 식당 한 곳: 이름·종류·주소·거리, 최근 블로그 언급, [후기 보기]·[후기 쓰기]·카카오맵 */
export function PlaceCard({
  place,
  recent,
  rank,
  detailHref,
  actions,
}: {
  place: FoodPlace;
  recent?: number;
  rank?: number;
  detailHref?: string;
  actions?: React.ReactNode;
}) {
  const hot = recent != null && recent >= FOOD_HOT;
  return (
    <article id={`place-${place.id}`} className="flex scroll-mt-20 gap-3 rounded-xl border border-line bg-surface p-4" data-food-place={place.id}>
      {rank != null && (
        <span aria-label={`${rank}위`} className={`mt-0.5 w-6 shrink-0 text-center text-lg font-extrabold ${rank <= 3 ? "text-accent" : "text-ink-soft"}`}>
          {rank}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h3 className="text-base font-bold">
            {detailHref ? (
              <Link href={detailHref} className="hover:underline">
                {place.name}
              </Link>
            ) : (
              place.name
            )}
          </h3>
          {place.category && <span className="text-xs text-ink-soft">{place.category}</span>}
          {hot && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent" data-food-hot>
              🔥 요즘 뜨는 곳
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {place.distance != null && <strong className="mr-1.5 font-semibold text-ink">{distanceLabel(place.distance)}</strong>}
          {place.address}
          {place.phone && <span className="ml-1.5">· {place.phone}</span>}
        </p>
        {recent != null && <p className="mt-1 text-xs text-ink-soft">📝 {buzzLabel(recent)}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {detailHref && (
            <Link href={detailHref} className="btn btn-primary text-sm">
              후기 보기
            </Link>
          )}
          <Link href={reviewWriteHref(place)} className="btn text-sm" data-food-write>
            ✏ 후기 쓰기
          </Link>
          <a href={place.mapUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-sm">
            🗺 지도
          </a>
          {actions}
        </div>
      </div>
    </article>
  );
}
