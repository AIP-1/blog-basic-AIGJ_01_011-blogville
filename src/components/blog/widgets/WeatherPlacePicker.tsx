"use client";

import { useRef, useState, useTransition } from "react";
import { WEATHER_CITIES } from "@/lib/weather";
import { PLACE_QUERY_MAX, placeFront, placeShort, type WeatherPlace } from "@/lib/weather-place";
import { findWeatherPlaces, saveWeatherPlace } from "./actions";

// ☀️ 날씨 위젯의 블로그 동네 고르기 (주인만). 동네 이름이나 역·건물 이름을 치면 카카오로 찾아 행정동 목록을 보여 준다.
// 목록에서 고르면 서버가 그 자리의 동 이름을 다시 확인해 저장한다. 도시 목록으로 되돌릴 수도 있다.
const DEBOUNCE_MS = 350;

type Props = {
  /** 블로그 도시. 동네를 쓰는 중이면 null (그때는 어느 도시를 골라도 바뀐다) */
  city: string | null;
  onPlace: (place: WeatherPlace) => void;
  onCity: (key: string) => void;
  onClose: () => void;
};

export function WeatherPlacePicker({ city, onPlace, onCity, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<WeatherPlace[] | null>(null);
  const [state, setState] = useState<"idle" | "searching" | "error">("idle");
  const [note, setNote] = useState("");
  const [saving, startSaving] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 늦게 온 앞 검색 결과가 새 결과를 덮지 않게
  const seq = useRef(0);

  function run(q: string) {
    const id = ++seq.current;
    setState("searching");
    findWeatherPlaces(q)
      .then((r) => {
        if (id !== seq.current) return;
        setPlaces(r.places);
        setState(r.ok ? "idle" : "error");
      })
      .catch(() => id === seq.current && setState("error"));
  }

  function change(value: string) {
    setQuery(value);
    setNote("");
    if (timer.current) clearTimeout(timer.current);
    const q = value.trim();
    if (q.length < 2) {
      seq.current++;
      setPlaces(null);
      setState("idle");
      return;
    }
    timer.current = setTimeout(() => run(q), DEBOUNCE_MS);
  }

  function pick(p: WeatherPlace) {
    startSaving(async () => {
      try {
        const { place } = await saveWeatherPlace(p.lat, p.lon);
        if (place) return onPlace(place);
      } catch {
        // 아래 안내
      }
      setNote("동네를 정하지 못했어요. 잠시 뒤 다시 해 보세요");
    });
  }

  return (
    <div
      className="w-full rounded-lg border border-line bg-bg/60 p-2"
      data-weather-picker
      // Esc로 닫는다
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (timer.current) clearTimeout(timer.current);
          if (query.trim()) run(query.trim());
        }}
      >
        <label className="mb-1 block text-xs font-semibold text-ink-soft" htmlFor="weather-place-q">
          블로그 날씨 동네 찾기
        </label>
        <input
          id="weather-place-q"
          type="search"
          value={query}
          onChange={(e) => change(e.target.value)}
          maxLength={PLACE_QUERY_MAX}
          placeholder="동네 이름 (예: 상무1동, 역삼동)"
          autoComplete="off"
          // 주인이 ✎를 눌러 연 칸이라 바로 칠 수 있게
          autoFocus
          // 16px보다 작으면 아이폰이 칸을 누를 때 화면을 확대한다
          className="min-h-11 w-full rounded-md border border-line bg-surface px-2 text-base text-ink"
        />
      </form>

      <div aria-live="polite" className="mt-1">
        {state === "searching" && <p className="px-1 py-1 text-xs text-ink-soft">찾는 중…</p>}
        {state === "error" && <p className="px-1 py-1 text-xs text-ink-soft">동네를 찾지 못했어요. 잠시 뒤 다시 해 보세요</p>}
        {state === "idle" && places?.length === 0 && <p className="px-1 py-1 text-xs text-ink-soft">찾는 동네가 없어요. 동 이름이나 역 이름으로 찾아보세요</p>}
        {places && places.length > 0 && state !== "error" && (
          <ul className="mt-1 max-h-52 overflow-y-auto" aria-label="찾은 동네">
            {places.map((p) => {
              const short = placeShort(p.name);
              const front = placeFront(p.name);
              return (
                <li key={p.name}>
                  <button
                    type="button"
                    onClick={() => pick(p)}
                    disabled={saving}
                    className="flex min-h-10 w-full items-center gap-1 rounded-md px-2 text-left text-sm hover:bg-line/40 disabled:opacity-60"
                  >
                    {front && <span className="text-ink-soft">{front}</span>}
                    <b>{short}</b>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {note && (
          <p className="px-1 py-1 text-xs text-ink-soft" role="status">
            {note}
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2 border-t border-line pt-2 text-xs text-ink-soft">
        <label className="flex items-center gap-1">
          도시로 고르기
          <select value={city ?? ""} onChange={(e) => onCity(e.target.value)} disabled={saving} className="rounded-md border border-line bg-surface px-1 py-0.5 text-base text-ink sm:text-xs">
            {city === null && (
              <option value="" disabled>
                동네 사용 중
              </option>
            )}
            {WEATHER_CITIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onClose} className="ml-auto rounded-md px-2 py-1 hover:bg-line/40">
          닫기
        </button>
      </div>
    </div>
  );
}
