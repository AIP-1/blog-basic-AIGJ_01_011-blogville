"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FoodPlace } from "@/lib/food";

// 🗺 맛집 지도 (카카오맵 JavaScript SDK). 열쇠(KAKAO_JS_KEY)는 원래 웹페이지에 드러나는 키라 서버가 화면에 넘겨 주고,
// 카카오 개발자 센터의 [플랫폼 > Web 사이트 도메인]으로 우리 주소에서만 쓰이게 막는다.
// 내 위치는 파란 점, 식당은 번호 핀. 핀을 누르면 말풍선, 목록의 [🗺 지도에서 보기]를 누르면 그 식당으로 옮긴다.

/* eslint-disable @typescript-eslint/no-explicit-any -- 카카오 SDK는 타입이 없다 */
declare global {
  interface Window {
    kakao?: any;
  }
}

export const FOOD_MAP_FOCUS = "food-map-focus";

let sdk: Promise<any> | null = null;
function loadKakao(key: string): Promise<any> {
  if (sdk) return sdk;
  sdk = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
    s.async = true;
    s.onload = () => (window.kakao?.maps ? window.kakao.maps.load(() => resolve(window.kakao)) : reject(new Error("kakao")));
    s.onerror = () => reject(new Error("kakao script"));
    document.head.appendChild(s);
  }).catch((e) => {
    sdk = null;
    throw e;
  });
  return sdk;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Props = {
  jsKey: string;
  places: FoodPlace[];
  /** 내 위치 (파란 점). 없으면 식당들이 다 보이게 */
  me?: { lat: number; lng: number } | null;
  /** 지도를 옮긴 뒤 [이 지역에서 다시 찾기] (내 주변 탭) */
  researchSort?: "distance" | "buzz";
  className?: string;
};

export function FoodMap({ jsKey, places, me = null, researchSort, className = "" }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const api = useRef<{ map: any; kakao: any; overlays: any[]; info: any } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [moved, setMoved] = useState(false);
  const router = useRouter();
  // 번호는 목록 순서 그대로 (좌표가 없는 곳은 핀만 빠진다)
  const pins = places.map((p, i) => ({ ...p, n: i + 1 })).filter((p) => p.lat !== null && p.lng !== null);
  const key = pins.map((p) => p.id).join(",") + (me ? `|${me.lat},${me.lng}` : "");

  useEffect(() => {
    let alive = true;
    loadKakao(jsKey)
      .then((kakao) => {
        if (!alive || !box.current) return;
        const { maps } = kakao;
        const center = me ? new maps.LatLng(me.lat, me.lng) : pins[0] ? new maps.LatLng(pins[0].lat, pins[0].lng) : new maps.LatLng(37.5665, 126.978);
        const map = new maps.Map(box.current, { center, level: 4 });
        map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT);
        const overlays: any[] = [];
        const info = new maps.CustomOverlay({ yAnchor: 1.45, zIndex: 20 });
        const bounds = new maps.LatLngBounds();
        if (me) {
          const dot = document.createElement("div");
          dot.className = "food-map-me";
          dot.title = "내 위치";
          overlays.push(new maps.CustomOverlay({ position: center, content: dot, zIndex: 10, map }));
          bounds.extend(center);
        }
        pins.forEach((p, i) => {
          const pos = new maps.LatLng(p.lat, p.lng);
          bounds.extend(pos);
          const pin = document.createElement("button");
          pin.type = "button";
          pin.className = "food-map-pin";
          pin.textContent = String(p.n);
          pin.setAttribute("aria-label", `${p.n}. ${p.name}`);
          pin.dataset.foodPin = p.id;
          pin.onclick = () => open(i);
          overlays.push(new maps.CustomOverlay({ position: pos, content: pin, yAnchor: 1, zIndex: 5, map }));
        });
        function open(i: number) {
          const p = pins[i];
          const el = document.createElement("div");
          el.className = "food-map-info";
          el.innerHTML = `<strong>${p.n}. ${esc(p.name)}</strong><span>${esc(p.category)}${p.distance !== null ? ` · ${p.distance >= 1000 ? (p.distance / 1000).toFixed(1) + "km" : p.distance + "m"}` : ""}</span><a href="${esc(p.mapUrl)}" target="_blank" rel="noopener noreferrer">카카오맵에서 보기 ›</a>`;
          info.setContent(el);
          info.setPosition(new maps.LatLng(p.lat, p.lng));
          info.setMap(map);
          map.panTo(new maps.LatLng(p.lat, p.lng));
        }
        if (pins.length + (me ? 1 : 0) > 1) map.setBounds(bounds, 40, 40, 40, 40);
        maps.event.addListener(map, "dragend", () => setMoved(true));
        maps.event.addListener(map, "click", () => info.setMap(null));
        api.current = { map, kakao, overlays, info };
        (api.current as any).open = open;
        setState("ready");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
      api.current?.overlays.forEach((o) => o.setMap(null));
      api.current?.info.setMap(null);
      api.current = null;
    };
    // 장소·내 위치가 바뀔 때만 다시 그린다
  }, [jsKey, key]); // eslint-disable-line react-hooks/exhaustive-deps

  // 목록의 [🗺 지도에서 보기]
  useEffect(() => {
    const onFocus = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const i = pins.findIndex((p) => p.id === id);
      if (i < 0 || !api.current) return;
      (api.current as any).open(i);
      box.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    window.addEventListener(FOOD_MAP_FOCUS, onFocus);
    return () => window.removeEventListener(FOOD_MAP_FOCUS, onFocus);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  function researchHere() {
    const c = api.current?.map.getCenter();
    if (!c) return;
    router.push(`/food?tab=near&lat=${c.getLat().toFixed(3)}&lng=${c.getLng().toFixed(3)}${researchSort === "buzz" ? "&sort=buzz" : ""}`);
    setMoved(false);
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-line ${className}`} data-food-map={state}>
      <div ref={box} className="h-72 w-full bg-bg sm:h-96" role="application" aria-label="맛집 지도" />
      {state === "loading" && <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-soft">지도를 불러오는 중…</p>}
      {state === "error" && (
        <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-ink-soft">
          지도를 불러오지 못했어요 (카카오 JavaScript 키·사이트 도메인 설정을 확인해 주세요). 아래 목록은 그대로 볼 수 있어요.
        </p>
      )}
      {state === "ready" && researchSort && moved && (
        <button type="button" onClick={researchHere} className="btn btn-primary absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full px-4 text-sm shadow-lg" data-food-research>
          🔄 이 지역에서 다시 찾기
        </button>
      )}
    </div>
  );
}

/** 목록 카드 옆 [🗺 지도에서 보기]: 지도가 그 식당으로 옮겨 말풍선을 연다 */
export function FocusOnMapButton({ id }: { id: string }) {
  return (
    <button type="button" className="btn btn-ghost px-2 text-sm" onClick={() => window.dispatchEvent(new CustomEvent(FOOD_MAP_FOCUS, { detail: id }))} data-food-focus={id}>
      🗺 지도에서 보기
    </button>
  );
}
