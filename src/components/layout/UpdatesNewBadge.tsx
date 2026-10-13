import { hasNewRelease } from "@/lib/releases";
import { listReleases } from "@/server/releases";

/**
 * [🆕 업데이트 소식] 옆 `NEW` (SUP-01): 최신 릴리스가 3일 안에 나왔으면.
 * 릴리스 목록은 10분 캐시를 같이 쓰고, GitHub이 늦어도 화면을 막지 않게 Suspense 안에서 그린다.
 */
export async function UpdatesNewBadge() {
  if (!hasNewRelease(await listReleases())) return null;
  return (
    <span className="rounded-full bg-danger px-1.5 text-xs leading-5 font-bold text-surface" data-updates-new>
      NEW
    </span>
  );
}
