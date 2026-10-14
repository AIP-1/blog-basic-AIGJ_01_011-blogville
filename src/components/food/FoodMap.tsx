"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FoodPlace } from "@/lib/food";

// 🗺 맛집 지도. 네이버 지도(NAVER_MAP_CLIENT_ID, 네이버 클라우드 Maps의 Web Dynamic Map)가 있으면 네이버, 없으면 카카오맵(KAKAO_JS_KEY).
// 두 열쇠 모두 원래 웹페이지에 드러나는 키라 서버가 화면에 넘겨 주고, 각 콘솔에 등록한 사이트 주소에서만 쓰인다.
// 내 위치는 파란 점, 식당은 번호 핀. 핀을 누르면 말풍선, 목록의 [🗺 지도에서 보기]를 누르면 그 식당으로 옮긴다.
// 지도마다 다른 부분은 아래 Adapter 하나로 감싼다.

/* eslint-disable @typescript-eslint/no-explicit-any -- 지도 SDK는 타입이 없다 */
declare global {
  interface Window {
    kakao?: any;
    naver?: any;
    navermap_authFailure?: () => void;
  }
}

export const FOOD_MAP_FOCUS = "food-map-focus";
export type MapProvider = { kind: "kakao" | "naver"; key: string };

type LL = { lat: number; lng: number };
type Adapter = {
  /** 지도 위에 HTML 요소를 그 좌표에 둔다. onClick은 핀을 눌렀을 때 */
  add(at: LL, el: HTMLElement, z: number, onClick?: () => void): () => void;
  info(at: LL, el: HTMLElement): void;
  closeInfo(): void;
  fit(points: LL[]): void;
  panTo(at: LL): void;
  center(): LL;
  onDragEnd(fn: () => void): void;
  onClick(fn: () => void): void;
};

const scripts = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  const hit = scripts.get(src);
  if (hit) return hit;
  const p = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("map script"));
    document.head.appendChild(s);
  }).catch((e) => {
    scripts.delete(src);
    throw e;
  });
  scripts.set(src, p);
  return p;
}

async function kakaoAdapter(key: string, box: HTMLElement, start: LL): Promise<Adapter> {
  await loadScript(`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`);
  const kakao = window.kakao;
  if (!kakao?.maps) throw new Error("kakao");
  await new Promise<void>((r) => kakao.maps.load(() => r()));
  const { maps } = kakao;
  const ll = (p: LL) => new maps.LatLng(p.lat, p.lng);
  const map = new maps.Map(box, { center: ll(start), level: 4 });
  map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT);
  const info = new maps.CustomOverlay({ yAnchor: 1.45, zIndex: 20 });
  return {
    add(at, el, z, onClick) {
      if (onClick) el.onclick = onClick;
      const o = new maps.CustomOverlay({ position: ll(at), content: el, yAnchor: onClick ? 1 : 0.5, zIndex: z, map });
      return () => o.setMap(null);
    },
    info(at, el) {
      info.setContent(el);
      info.setPosition(ll(at));
      info.setMap(map);
    },
    closeInfo: () => info.setMap(null),
    fit(points) {
      const b = new maps.LatLngBounds();
      points.forEach((p) => b.extend(ll(p)));
      map.setBounds(b, 40, 40, 40, 40);
    },
    panTo: (at) => map.panTo(ll(at)),
    center() {
      const c = map.getCenter();
      return { lat: c.getLat(), lng: c.getLng() };
    },
    onDragEnd: (fn) => maps.event.addListener(map, "dragend", fn),
    onClick: (fn) => maps.event.addListener(map, "click", fn),
  };
}

async function naverAdapter(key: string, box: HTMLElement, start: LL, onAuthFail: () => void): Promise<Adapter> {
  // 열쇠·사이트 주소가 틀리면 네이버가 이 함수를 부른다
  window.navermap_authFailure = onAuthFail;
  await loadScript(`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}`);
  const naver = window.naver;
  if (!naver?.maps) throw new Error("naver");
  const { maps } = naver;
  const ll = (p: LL) => new maps.LatLng(p.lat, p.lng);
  const map = new maps.Map(box, { center: ll(start), zoom: 16, zoomControl: true, zoomControlOptions: { position: maps.Position.RIGHT_CENTER } });
  const info = new maps.InfoWindow({ content: "", borderWidth: 0, backgroundColor: "transparent", disableAnchor: true, pixelOffset: new maps.Point(0, -8) });
  return {
    add(at, el, z, onClick) {
      const w = onClick ? 30 : 18;
      const m = new maps.Marker({ position: ll(at), map, zIndex: z, icon: { content: el, anchor: new maps.Point(w / 2, onClick ? w : w / 2) } });
      if (onClick) maps.Event.addListener(m, "click", onClick);
      return () => m.setMap(null);
    },
    info(at, el) {
      info.setContent(el);
      info.open(map, ll(at));
    },
    closeInfo: () => info.close(),
    fit(points) {
      const b = new maps.LatLngBounds(ll(points[0]), ll(points[0]));
      points.forEach((p) => b.extend(ll(p)));
      map.fitBounds(b, { top: 40, right: 40, bottom: 40, left: 40 });
    },
    panTo: (at) => map.panTo(ll(at)),
    center() {
      const c = map.getCenter();
      return { lat: c.lat(), lng: c.lng() };
    },
    onDragEnd: (fn) => maps.Event.addListener(map, "dragend", fn),
    onClick: (fn) => maps.Event.addListener(map, "click", fn),
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Props = {
  provider: MapProvider;
  places: FoodPlace[];
  /** 내 위치 (파란 점). 없으면 식당들이 다 보이게 */
  me?: { lat: number; lng: number } | null;
  /** 지도를 옮긴 뒤 [이 지역에서 다시 찾기] (내 주변 탭) */
  researchSort?: "distance" | "buzz";
  className?: string;
};

export function FoodMap({ provider, places, me = null, researchSort, className = "" }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const api = useRef<{ map: Adapter; open: (i: number) => void } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [moved, setMoved] = useState(false);
  const router = useRouter();
  // 번호는 목록 순서 그대로 (좌표가 없는 곳은 핀만 빠진다)
  const pins = places.map((p, i) => ({ ...p, n: i + 1 })).filter((p) => p.lat !== null && p.lng !== null) as (FoodPlace & { n: number; lat: number; lng: number })[];
  const key = pins.map((p) => p.id).join(",") + (me ? `|${me.lat},${me.lng}` : "");

  useEffect(() => {
    let alive = true;
    const removers: (() => void)[] = [];
    const start = me ?? (pins[0] ? { lat: pins[0].lat, lng: pins[0].lng } : { lat: 37.5665, lng: 126.978 });
    const fail = () => alive && setState("error");
    (provider.kind === "naver" ? naverAdapter(provider.key, box.current!, start, fail) : kakaoAdapter(provider.key, box.current!, start))
      .then((map) => {
        if (!alive) return;
        if (me) {
          const dot = document.createElement("div");
          dot.className = "food-map-me";
          dot.title = "내 위치";
          removers.push(map.add(me, dot, 10));
        }
        const open = (i: number) => {
          const p = pins[i];
          const el = document.createElement("div");
          el.className = "food-map-info";
          const naverLink = `https://map.naver.com/p/search/${encodeURIComponent(p.name + " " + p.address.split(" ").slice(0, 2).join(" "))}`;
          el.innerHTML = `<strong>${p.n}. ${esc(p.name)}</strong><span>${esc(p.category)}${p.distance !== null ? ` · ${p.distance >= 1000 ? (p.distance / 1000).toFixed(1) + "km" : p.distance + "m"}` : ""}</span><span class="food-map-links"><a href="${esc(naverLink)}" target="_blank" rel="noopener noreferrer">네이버 지도 ›</a><a href="${esc(p.mapUrl)}" target="_blank" rel="noopener noreferrer">카카오맵 ›</a></span>`;
          map.info({ lat: p.lat, lng: p.lng }, el);
          map.panTo({ lat: p.lat, lng: p.lng });
        };
        pins.forEach((p, i) => {
          const pin = document.createElement("button");
          pin.type = "button";
          pin.className = "food-map-pin";
          pin.textContent = String(p.n);
          pin.setAttribute("aria-label", `${p.n}. ${p.name}`);
          pin.dataset.foodPin = p.id;
          removers.push(map.add({ lat: p.lat, lng: p.lng }, pin, 5, () => open(i)));
        });
        const points = [...(me ? [me] : []), ...pins.map((p) => ({ lat: p.lat, lng: p.lng }))];
        if (points.length > 1) map.fit(points);
        map.onDragEnd(() => setMoved(true));
        map.onClick(() => map.closeInfo());
        api.current = { map, open };
        setState("ready");
      })
      .catch(fail);
    return () => {
      alive = false;
      removers.forEach((r) => r());
      api.current?.map.closeInfo();
      api.current = null;
    };
    // 장소·내 위치·지도 종류가 바뀔 때만 다시 그린다
  }, [provider.kind, provider.key, key]); // eslint-disable-line react-hooks/exhaustive-deps

  // 목록의 [🗺 지도에서 보기]
  useEffect(() => {
    const onFocus = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const i = pins.findIndex((p) => p.id === id);
      if (i < 0 || !api.current) return;
      api.current.open(i);
      box.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    window.addEventListener(FOOD_MAP_FOCUS, onFocus);
    return () => window.removeEventListener(FOOD_MAP_FOCUS, onFocus);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  function researchHere() {
    const c = api.current?.map.center();
    if (!c) return;
    router.push(`/food?tab=near&lat=${c.lat.toFixed(3)}&lng=${c.lng.toFixed(3)}${researchSort === "buzz" ? "&sort=buzz" : ""}`);
    setMoved(false);
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-line ${className}`} data-food-map={state}>
      <div ref={box} className="h-72 w-full bg-bg sm:h-96" role="application" aria-label="맛집 지도" />
      {state === "loading" && <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-soft">지도를 불러오는 중…</p>}
      {state === "error" && (
        <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-ink-soft">
          지도를 불러오지 못했어요 ({provider.kind === "naver" ? "네이버 클라우드 Maps의 Client ID·Web 서비스 URL" : "카카오 JavaScript 키·사이트 도메인"} 설정을 확인해 주세요). 아래 목록은 그대로 볼 수 있어요.
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
