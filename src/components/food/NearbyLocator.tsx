"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { FOOD_MESSAGES } from "@/lib/food";

// 지난 위치: 이 브라우저에만 6시간 기억한다 (서버에는 저장하지 않는다). 다음에 오면 [📍 지난 위치로 보기] 한 번으로
const LAST_KEY = "bv-food-last-place";
const LAST_TTL_MS = 6 * 3_600_000;
type Last = { lat: string; lng: string; at: number };

/** 지난 위치 (6시간 지났으면 빈 값) */
function readLast(): string {
  try {
    const raw = localStorage.getItem(LAST_KEY) ?? "";
    const v = raw ? (JSON.parse(raw) as Last) : null;
    return v && typeof v.lat === "string" && typeof v.lng === "string" && Date.now() - v.at < LAST_TTL_MS ? raw : "";
  } catch {
    return "";
  }
}
const noop = () => () => {};

const timeLabel = (at: number) => new Date(at).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** 📍 내 위치로 찾기: 브라우저에게 위치를 묻고 주소에 붙여 다시 그린다 */
export function NearbyLocator({ sort, located, radius = 500, kind = "all" }: { sort: "distance" | "buzz"; located: boolean; radius?: number; kind?: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "denied" | "unsupported">("idle");
  // 서버·첫 그리기에서는 빈 값 (지난 위치 단추는 브라우저에서만)
  const raw = useSyncExternalStore(noop, readLast, () => "");
  const last: Last | null = raw ? (JSON.parse(raw) as Last) : null;

  const go = (lat: string, lng: string) =>
    router.push(`/food?tab=near&lat=${lat}&lng=${lng}${radius !== 500 ? `&r=${radius}` : ""}${kind !== "all" ? `&kind=${kind}` : ""}${sort === "buzz" ? "&sort=buzz" : ""}`);

  function locate() {
    if (!("geolocation" in navigator)) return setState("unsupported");
    setState("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(3);
        const lng = pos.coords.longitude.toFixed(3);
        try {
          localStorage.setItem(LAST_KEY, JSON.stringify({ lat, lng, at: Date.now() }));
        } catch {}
        setState("idle");
        go(lat, lng);
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? "denied" : "unsupported"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn btn-primary" onClick={locate} disabled={state === "busy"} data-food-locate>
        {state === "busy" ? "위치 찾는 중…" : located ? "📍 다시 찾기" : "📍 내 위치로 찾기"}
      </button>
      {!located && last && state !== "busy" && (
        <button type="button" className="btn" onClick={() => go(last!.lat, last!.lng)} data-food-last>
          🕘 지난 위치로 보기 ({timeLabel(last.at)}에 찾은 곳)
        </button>
      )}
      {state === "denied" && <p className="text-sm text-danger">{FOOD_MESSAGES.denied}</p>}
      {state === "unsupported" && <p className="text-sm text-danger">{FOOD_MESSAGES.unsupported}</p>}
      {!located && state === "idle" && <p className="text-sm text-ink-soft">위치는 서버에 저장하지 않아요. 이 브라우저에만 6시간 기억해요.</p>}
    </div>
  );
}
