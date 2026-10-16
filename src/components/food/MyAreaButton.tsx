"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { geoErrorText, locate as findMe } from "@/lib/geolocate";

/** 📍 내 동네 인기: 브라우저에게 위치를 묻고 그 동네(법정동) 지역 인기로 간다. 위치는 저장하지 않는다 */
export function MyAreaButton({ kind, current }: { kind: string; current: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy">("idle");
  const [error, setError] = useState("");

  function locate() {
    setState("busy");
    setError("");
    findMe()
      .then((pos) => router.push(`/food?tab=region&lat=${pos.lat.toFixed(3)}&lng=${pos.lng.toFixed(3)}${kind !== "all" ? `&kind=${kind}` : ""}`))
      .catch((e: unknown) => setError(geoErrorText(e)))
      .finally(() => setState("idle"));
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
      {error && (
        <span className="text-sm text-danger" role="alert" data-geo-error>
          {error}
        </span>
      )}
    </span>
  );
}
