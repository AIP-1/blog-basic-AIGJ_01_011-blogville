"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FOOD_MESSAGES } from "@/lib/food";

/** 📍 내 동네 인기: 브라우저에게 위치를 묻고 그 동네(법정동) 지역 인기로 간다. 위치는 저장하지 않는다 */
export function MyAreaButton({ kind, current }: { kind: string; current: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "denied" | "unsupported">("idle");

  function locate() {
    if (!("geolocation" in navigator)) return setState("unsupported");
    setState("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState("idle");
        router.push(`/food?tab=region&lat=${pos.coords.latitude.toFixed(3)}&lng=${pos.coords.longitude.toFixed(3)}${kind !== "all" ? `&kind=${kind}` : ""}`);
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? "denied" : "unsupported"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={locate}
        disabled={state === "busy"}
        aria-pressed={!!current}
        data-food-my-area
        className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm ${current ? "border-ink bg-ink font-bold text-surface" : "border-accent text-accent hover:bg-accent/10"}`}
      >
        {state === "busy" ? "위치 찾는 중…" : current ? `📍 내 동네 · ${current}` : "📍 내 동네 인기"}
      </button>
      {state === "denied" && <span className="text-sm text-danger">{FOOD_MESSAGES.denied}</span>}
      {state === "unsupported" && <span className="text-sm text-danger">{FOOD_MESSAGES.unsupported}</span>}
    </span>
  );
}
