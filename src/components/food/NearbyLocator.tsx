"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FOOD_MESSAGES } from "@/lib/food";

/** 📍 내 위치로 찾기: 브라우저에게 위치를 묻고 주소에 붙여 다시 그린다. 서버는 위치를 저장하지 않는다 */
export function NearbyLocator({ sort, located, radius = 500, kind = "all" }: { sort: "distance" | "buzz"; located: boolean; radius?: number; kind?: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "denied" | "unsupported">("idle");

  function locate() {
    if (!("geolocation" in navigator)) return setState("unsupported");
    setState("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(3);
        const lng = pos.coords.longitude.toFixed(3);
        setState("idle");
        router.push(`/food?tab=near&lat=${lat}&lng=${lng}${radius !== 500 ? `&r=${radius}` : ""}${kind !== "all" ? `&kind=${kind}` : ""}${sort === "buzz" ? "&sort=buzz" : ""}`);
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
      {state === "denied" && <p className="text-sm text-danger">{FOOD_MESSAGES.denied}</p>}
      {state === "unsupported" && <p className="text-sm text-danger">{FOOD_MESSAGES.unsupported}</p>}
      {!located && state === "idle" && <p className="text-sm text-ink-soft">위치는 이 화면에서만 쓰고 저장하지 않아요.</p>}
    </div>
  );
}
