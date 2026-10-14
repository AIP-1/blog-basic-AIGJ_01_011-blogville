"use client";

import { useEffect, useRef, useState } from "react";

type Pin = { id: string; name: string; lat: number; lng: number; hot?: boolean };

type KakaoMaps = {
  load: (cb: () => void) => void;
  LatLng: new (lat: number, lng: number) => unknown;
  LatLngBounds: new () => { extend: (p: unknown) => void };
  Map: new (el: HTMLElement, opts: { center: unknown; level: number }) => { setBounds: (b: unknown) => void; relayout: () => void };
  Marker: new (opts: { map: unknown; position: unknown; title?: string }) => unknown;
  CustomOverlay: new (opts: { map: unknown; position: unknown; content: HTMLElement | string; yAnchor?: number; zIndex?: number }) => unknown;
  Circle: new (opts: Record<string, unknown>) => unknown;
  event: { addListener: (target: unknown, type: string, cb: () => void) => void };
};

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

let loading: Promise<KakaoMaps> | null = null;

/** 카카오 지도 SDK를 한 번만 불러온다 (autoload=false → kakao.maps.load) */
function loadKakao(jsKey: string): Promise<KakaoMaps> {
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao.maps);
  loading ??= new Promise<KakaoMaps>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(jsKey)}&autoload=false`;
    s.async = true;
    s.onload = () => (window.kakao ? window.kakao.maps.load(() => resolve(window.kakao!.maps)) : reject(new Error("kakao")));
    s.onerror = () => {
      loading = null;
      reject(new Error("kakao sdk"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

function label(text: string, hot: boolean): HTMLElement {
  const el = document.createElement("div");
  el.textContent = (hot ? "🔥 " : "") + text;
  el.style.cssText =
    "padding:2px 8px;border-radius:999px;background:#fff;color:#1f2937;border:1px solid #d1d5db;font-size:12px;font-weight:600;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.15);transform:translateY(-44px)";
  return el;
}

/**
 * 🗺 카카오 지도: 내 위치(파란 점, 반경 원)와 식당 핀. 핀을 누르면 아래 식당 카드로 내려간다.
 * JavaScript 키(KAKAO_JS_KEY)는 등록한 사이트 도메인에서만 동작한다.
 */
export function FoodMap({ jsKey, me, radius, pins }: { jsKey: string; me?: { lat: number; lng: number } | null; radius?: number; pins: Pin[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let gone = false;
    loadKakao(jsKey)
      .then((maps) => {
        if (gone || !box.current) return;
        box.current.innerHTML = "";
        const center = me ? new maps.LatLng(me.lat, me.lng) : pins[0] ? new maps.LatLng(pins[0].lat, pins[0].lng) : new maps.LatLng(37.5665, 126.978);
        const map = new maps.Map(box.current, { center, level: 5 });
        const bounds = new maps.LatLngBounds();
        if (me) {
          const dot = document.createElement("div");
          dot.title = "내 위치";
          dot.style.cssText = "width:16px;height:16px;border-radius:50%;background:#2a78d6;border:3px solid #fff;box-shadow:0 0 0 2px rgba(42,120,214,.35)";
          new maps.CustomOverlay({ map, position: center, content: dot, yAnchor: 0.5, zIndex: 3 });
          if (radius) new maps.Circle({ map, center, radius, strokeWeight: 1, strokeColor: "#2a78d6", strokeOpacity: 0.6, fillColor: "#2a78d6", fillOpacity: 0.06 });
          bounds.extend(center);
        }
        for (const p of pins) {
          const pos = new maps.LatLng(p.lat, p.lng);
          const marker = new maps.Marker({ map, position: pos, title: p.name });
          new maps.CustomOverlay({ map, position: pos, content: label(p.name, !!p.hot), yAnchor: 0, zIndex: 2 });
          maps.event.addListener(marker, "click", () => {
            document.getElementById(`place-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
          bounds.extend(pos);
        }
        if (pins.length > 0) map.setBounds(bounds);
      })
      .catch(() => !gone && setFailed(true));
    return () => {
      gone = true;
    };
  }, [jsKey, me, radius, pins]);

  if (failed) return <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-ink-soft">지도를 불러오지 못했어요. 아래 목록으로 봐 주세요.</p>;
  return <div ref={box} role="img" aria-label="식당 지도" className="h-72 w-full overflow-hidden rounded-xl border border-line bg-bg sm:h-96" data-food-map />;
}
