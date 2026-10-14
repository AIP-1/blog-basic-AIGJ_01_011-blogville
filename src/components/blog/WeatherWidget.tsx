"use client";

import { useCallback, useEffect, useState } from "react";
import { dayLabel, weatherIcon, type Weather } from "@/lib/weather";
import type { WeatherCityKey, WidgetSize } from "@/lib/widgets";

const POS_KEY = "bv-weather-pos";

function readPos(): { lat: number; lon: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(POS_KEY) ?? "null");
    return v && typeof v.lat === "number" && typeof v.lon === "number" ? v : null;
  } catch {
    return null;
  }
}

function todayKST(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * 옆 칸 🌤️ 이번 주 날씨: 처음엔 블로그 주인이 고른 도시, [📍 내 위치]를 누르면 브라우저가 위치를 묻고 그 위치로 바꾼다.
 * 고른 위치는 이 브라우저에만 기억한다 (다음에 와도 다시 묻지 않는다). 크게 = 7일, 작게 = 오늘만.
 */
export function WeatherWidget({ city, initial, size }: { city: WeatherCityKey; initial: Weather | null; size: WidgetSize }) {
  const [weather, setWeather] = useState(initial);
  const [mine, setMine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(initial ? null : "날씨를 불러오지 못했어요");

  const load = useCallback(async (query: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/weather?${query}`);
      if (!res.ok) throw new Error();
      setWeather((await res.json()) as Weather);
      setNote(null);
      return true;
    } catch {
      setNote("날씨를 불러오지 못했어요");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const pos = readPos();
    if (!pos) return;
    // 전에 고른 내 위치: 조용히 바꾼다 (실패하면 기본 도시 그대로)
    fetch(`/api/weather?lat=${pos.lat}&lon=${pos.lon}`)
      .then((res) => (res.ok ? (res.json() as Promise<Weather>) : Promise.reject()))
      .then((w) => {
        setWeather(w);
        setNote(null);
        setMine(true);
      })
      .catch(() => {});
  }, []);

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) return setNote("이 브라우저는 위치를 알려 주지 않아요");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const pos = { lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100 };
        if (await load(`lat=${pos.lat}&lon=${pos.lon}`)) {
          try {
            localStorage.setItem(POS_KEY, JSON.stringify(pos));
          } catch {}
          setMine(true);
        }
      },
      () => {
        setBusy(false);
        setNote("위치를 쓸 수 없어요 (브라우저에서 위치 허용을 확인해 주세요)");
      },
      { maximumAge: 30 * 60_000, timeout: 10_000 },
    );
  };

  const useCity = async () => {
    try {
      localStorage.removeItem(POS_KEY);
    } catch {}
    if (await load(`city=${city}`)) setMine(false);
  };

  const today = todayKST();
  const first = weather?.days[0];
  const now = weather?.now ?? (first ? { temp: first.max, code: first.code } : null);
  const [icon, label] = now ? weatherIcon(now.code) : ["", ""];

  return (
    <section className="widget" aria-labelledby="w-weather" data-widget="weather" data-size={size} aria-busy={busy}>
      <h2 id="w-weather" className="widget-title flex items-center gap-2">
        <span className="flex-1">🌤️ {size === "sm" ? "오늘 날씨" : "이번 주 날씨"}</span>
        <button
          type="button"
          onClick={mine ? useCity : useMyLocation}
          disabled={busy}
          className="btn btn-ghost min-h-9 px-2 text-xs font-normal"
          data-weather-locate
        >
          {mine ? "기본 도시로" : "📍 내 위치"}
        </button>
      </h2>
      {weather && now && first ? (
        <>
          <div className="flex items-center gap-3 px-1">
            <span aria-hidden className="text-4xl leading-none">
              {icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold tabular-nums" data-weather-now>
                  {now.temp}°
                </span>
                <span className="text-sm text-ink-soft">{label}</span>
              </p>
              <p className="truncate text-xs text-ink-soft" data-weather-place>
                {mine && "📍 "}
                {weather.place} · 최고 {first.max}° / 최저 {first.min}°{first.rain !== null && ` · 비 ${first.rain}%`}
              </p>
            </div>
          </div>
          {size === "lg" && (
            <ol className="mt-3 grid grid-cols-7 gap-0.5 border-t border-line pt-2 text-center text-xs" aria-label="7일 예보">
              {weather.days.map((d) => {
                const [i, l] = weatherIcon(d.code);
                return (
                  <li key={d.date} className="flex flex-col items-center gap-0.5" aria-label={`${dayLabel(d.date, today)} ${l} 최고 ${d.max}도 최저 ${d.min}도`}>
                    <span className={`font-semibold ${d.date === today ? "text-accent" : "text-ink-soft"}`}>{dayLabel(d.date, today)}</span>
                    <span aria-hidden className="text-lg leading-tight">
                      {i}
                    </span>
                    <span className="font-semibold tabular-nums text-[#d32f2f] dark:text-[#ff6b6b]">{d.max}°</span>
                    <span className="tabular-nums text-[#1565c0] dark:text-[#64a8ff]">{d.min}°</span>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      ) : null}
      {note && <p className="px-1 pt-1 text-xs text-ink-soft">{note}</p>}
      <p className="mt-2 px-1 text-[11px] text-ink-soft">
        날씨: <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="underline">Open-Meteo</a>
      </p>
    </section>
  );
}
