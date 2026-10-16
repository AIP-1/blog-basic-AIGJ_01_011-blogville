"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { geoErrorText, locate } from "@/lib/geolocate";
import { cityOf, dustGrade, formatTemp, WEATHER_CITIES, weatherLook, weekdayOf, type DustGrade, type Weather } from "@/lib/weather";
import { placeFront, placeShort, type WeatherPlace } from "@/lib/weather-place";
import { saveWeatherCity } from "./actions";
import { WeatherPlacePicker } from "./WeatherPlacePicker";

// ☀️ 이번 주 날씨 (위젯 보드). 처음엔 블로그 주인이 고른 동네나 도시(기본 서울), 보는 사람이 "내 위치"를 허락하면 그 자리.
// 자료는 /api/weather (서버가 Open-Meteo를 30분 기억). 한 번 허락한 사람은 다음에 오면 바로 내 위치로 보여 준다.
const HERE_KEY = "bv-weather-here";

type Props = {
  blog: { weatherCity?: string | null; weatherPlace?: string | null; weatherLat?: number | null; weatherLon?: number | null };
  isOwner?: boolean;
  /** 주인이 동네를 찾아 고를 수 있는지 (카카오 열쇠가 있을 때). 없으면 도시 목록 */
  placeSearch?: boolean;
};
type Data = { place: { name: string | null; city: string | null; full?: string | null }; weather: Weather };

const UP = "text-[#d32f2f] dark:text-[#ff6b6b]";
const DOWN = "text-[#1565c0] dark:text-[#64a8ff]";
const DUST_TONE: Record<DustGrade, string> = {
  좋음: DOWN,
  보통: "text-[#2e7d32] dark:text-[#66bb6a]",
  나쁨: "text-[#ef6c00] dark:text-[#ffa726]",
  "매우 나쁨": UP,
};

type Here = { lat: number; lon: number };

/** 이 브라우저에 기억한 내 위치(0.1도로 줄인 값). Safari는 허락을 그 방문 동안만 기억해 다음엔 다시 물으므로 좌표를 둔다 */
function readHere(): Here | null {
  try {
    const v = JSON.parse(localStorage.getItem(HERE_KEY) ?? "null") as Here | null;
    return v && Number.isFinite(v.lat) && Number.isFinite(v.lon) ? { lat: v.lat, lon: v.lon } : null;
  } catch {
    return null;
  }
}
function writeHere(here: Here | null) {
  try {
    if (here) localStorage.setItem(HERE_KEY, JSON.stringify(here));
    else localStorage.removeItem(HERE_KEY);
  } catch {
    // 저장이 막힌 브라우저는 이번에만 내 위치
  }
}

const AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

/** 미세먼지만 브라우저에서 직접 (Open-Meteo는 열쇠가 없고 CORS를 연다). 못 받으면 null */
async function fetchAir(lat: number, lon: number): Promise<{ pm10: number | null; pm25: number | null } | null> {
  try {
    const res = await fetch(`${AIR_URL}?latitude=${lat}&longitude=${lon}&timezone=auto&current=pm10,pm2_5`, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const cur = ((await res.json()) as { current?: { pm10?: unknown; pm2_5?: unknown } }).current;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const air = { pm10: num(cur?.pm10), pm25: num(cur?.pm2_5) };
    return air.pm10 === null && air.pm25 === null ? null : air;
  } catch {
    return null;
  }
}

export function WeatherWidget({ blog, isOwner = false, placeSearch = false }: Props) {
  const [city, setCity] = useState(cityOf(blog.weatherCity).key);
  // 주인이 고른 동네 ("광주 서구 상무1동"). 도시가 비어 있을 때만 쓴다 (동네를 고르면 도시를 비우고, 도시를 고르면 동네를 지운다)
  const [place, setPlace] = useState<WeatherPlace | null>(
    !blog.weatherCity && blog.weatherPlace && blog.weatherLat != null && blog.weatherLon != null
      ? { name: blog.weatherPlace, lat: blog.weatherLat, lon: blog.weatherLon }
      : null,
  );
  const [picking, setPicking] = useState(false);
  const pickToggle = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  // 받은 자료와 그 질문 (자리를 바꾸면 새 자료가 올 때까지 옛 자리 날씨를 새 이름으로 보여 주지 않는다)
  const [data, setData] = useState<(Data & { q: string }) | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [note, setNote] = useState("");
  const [saving, startSaving] = useTransition();

  // ↻를 누를 때마다 1씩 늘려 다시 받는다 (브라우저가 기억한 5분도 건너뛴다)
  const [tick, setTick] = useState(0);

  // 지금 보여 줄 자리: 보는 사람 위치 > 주인이 고른 동네 > 블로그 도시
  const spot = coords ?? place ?? cityOf(city);
  const q = coords || place ? `lat=${spot.lat}&lon=${spot.lon}` : `city=${city}`;

  useEffect(() => {
    let stopped = false;
    fetch(`/api/weather?${q}`, tick > 0 ? { cache: "reload" } : undefined)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as Data;
        if (stopped) return;
        setData({ ...json, q });
        setState("ok");
        // 서버가 미세먼지를 못 받아 왔으면(운영 서버에서 대기질 서버가 막힐 때가 있다) 브라우저가 직접 받아 채운다
        if (json.weather.pm10 === null && json.weather.pm25 === null) {
          const air = await fetchAir(spot.lat, spot.lon);
          if (!stopped && air) setData((d) => (d && d.q === q ? { ...d, weather: { ...d.weather, ...air } } : d));
        }
      })
      .catch(() => !stopped && setState("error"));
    return () => {
      stopped = true;
    };
  }, [q, spot, tick]);

  const askHere = useCallback((quiet: boolean) => {
    if (!quiet) setNote("위치를 확인하는 중…");
    locate(30 * 60_000)
      .then((p) => {
        // 0.01도(약 1km)로 줄여서만 보낸다 (그 동네 칸 예보)
        const here = { lat: Math.round(p.lat * 100) / 100, lon: Math.round(p.lng * 100) / 100 };
        setCoords(here);
        writeHere(here);
        setNote("");
      })
      .catch((e: unknown) => {
        if (!quiet) writeHere(null);
        if (!quiet) setNote(`${geoErrorText(e)} 지금은 블로그 날씨를 보여 드려요.`);
      });
  }, []);

  // 전에 내 위치를 쓴 사람은 기억한 자리로 바로 그리고, 지금 허락돼 있으면 조용히 새 자리로 바꾼다
  useEffect(() => {
    const here = readHere();
    if (!here) return;
    // 서버 그림과 맞춘 다음에 바꾼다 (첫 그리기는 블로그 도시)
    void Promise.resolve().then(() => setCoords(here));
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((p) => p.state === "granted" && askHere(true))
      .catch(() => {});
  }, [askHere]);

  function backToCity() {
    writeHere(null);
    setCoords(null);
  }

  // 동네 고르기 칸을 닫으면 ✎ 버튼으로 돌아간다 (키보드로 고른 사람이 맨 위로 튀지 않게)
  function closePicker() {
    setPicking(false);
    pickToggle.current?.focus();
  }

  function changeCity(key: string) {
    setCity(key);
    setPlace(null);
    setCoords(null);
    closePicker();
    startSaving(async () => {
      let ok = false;
      try {
        ok = (await saveWeatherCity(key)).ok;
      } catch {
        // 아래 안내
      }
      setNote(ok ? `블로그 날씨 도시를 바꿨어요: ${cityOf(key).name}` : "도시를 바꾸지 못했어요");
    });
  }

  function changePlace(p: WeatherPlace) {
    setPlace(p);
    setCoords(null);
    closePicker();
    setNote(`블로그 날씨 동네를 바꿨어요: ${p.name}`);
  }

  // 지금 자리의 자료만 쓴다
  const shown = data?.q === q ? data : null;
  const w = shown?.weather;
  // 블로그가 정한 자리 (주인이 고른 동네, 없으면 도시)
  const home = place ? placeShort(place.name) : cityOf(city).name;
  // 내 위치면 동 이름 ("📍 상무1동"), 동을 모르면 "📍 내 위치"
  const placeName = coords ? `📍 ${(shown?.place.city === null && shown.place.name) || "내 위치"}` : place ? home : (shown?.place.name ?? cityOf(city).name);
  const placeTitle = coords ? (shown?.place.full ? `${shown.place.full} 날씨` : undefined) : place ? `${place.name} 날씨` : undefined;

  return (
    <section className="widget @container" aria-labelledby="w-weather" data-weather-widget aria-busy={state === "loading"}>
      <div className="flex items-center gap-2 px-2 pb-2 pt-1">
        <h2 id="w-weather" className="font-bold">
          날씨
        </h2>
        <span className="ml-auto flex min-w-0 text-sm text-ink-soft" data-weather-place title={placeTitle}>
          {!coords && place && placeFront(place.name) ? (
            // "광주 서구 상무1동": 좁으면 앞쪽만 줄이고 동 이름은 늘 보인다
            <>
              <span className="truncate">{placeFront(place.name)}&nbsp;</span>
              <span className="shrink-0">{home}</span>
            </>
          ) : (
            <span className="truncate">{placeName}</span>
          )}
        </span>
        <button type="button" onClick={() => setTick((t) => t + 1)} className="grid size-8 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-line/40" aria-label="날씨 새로 받기" title="새로 받기">
          ↻
        </button>
      </div>

      {state === "error" && !w ? (
        <p className="px-2 py-6 text-center text-sm text-ink-soft" role="status">
          날씨를 받지 못했어요. 잠시 뒤 ↻를 눌러 보세요
        </p>
      ) : !w ? (
        // 불러오는 동안 뼈대
        <div className="grid animate-pulse gap-3 px-2 pb-2 @md:grid-cols-2" aria-hidden>
          <div className="h-24 rounded-lg bg-line/50" />
          <div className="h-24 rounded-lg bg-line/50" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 px-2 @md:grid-cols-[auto_1fr] @md:items-center">
            {/* 지금 */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-3">
                <span className="text-5xl leading-none" aria-hidden>
                  {weatherLook(w.code, w.isDay).icon}
                </span>
                <div>
                  <p className="text-4xl font-bold tabular-nums leading-tight" data-weather-temp>
                    {formatTemp(w.temp)}
                  </p>
                  <p className="font-semibold">{weatherLook(w.code, w.isDay).label}</p>
                </div>
              </div>
              {w.min !== null && w.max !== null && (
                <p className="text-sm tabular-nums">
                  <span className="sr-only">최저 </span>
                  <span className={DOWN}>{formatTemp(w.min)}</span>
                  <span className="text-ink-soft"> / </span>
                  <span className="sr-only">최고 </span>
                  <span className={UP}>{formatTemp(w.max)}</span>
                </p>
              )}
              <Dust pm10={w.pm10} pm25={w.pm25} />
            </div>
            {/* 시간대별 기온 */}
            {w.hours.length > 1 && <Hours hours={w.hours} />}
          </div>

          {/* 이번 주 */}
          <ol className="mt-3 grid grid-cols-7 gap-0.5 border-t border-line px-1 pt-2 text-center text-xs" aria-label="이번 주 날씨">
            {w.days.map((d, i) => {
              const look = weatherLook(d.code);
              return (
                <li key={d.date} className="flex flex-col items-center gap-0.5" data-weather-day={d.date}>
                  <span className={`font-semibold ${i === 0 ? "" : "text-ink-soft"}`}>{i === 0 ? "오늘" : weekdayOf(d.date)}</span>
                  <span className="text-lg leading-none" title={look.label}>
                    <span aria-hidden>{look.icon}</span>
                    <span className="sr-only">{look.label}</span>
                  </span>
                  <span className={`tabular-nums ${d.rain !== null && d.rain >= 30 ? DOWN : "text-ink-soft"}`}>
                    <span className="sr-only">비 올 확률 </span>
                    {d.rain === null ? "-" : `${d.rain}%`}
                  </span>
                  <span className={`tabular-nums font-semibold ${UP}`}>{Math.round(d.max)}°</span>
                  <span className={`tabular-nums ${DOWN}`}>{Math.round(d.min)}°</span>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line px-2 pt-2 text-sm">
        {coords ? (
          <button type="button" onClick={backToCity} className="text-ink-soft hover:underline">
            {home} 날씨 보기
          </button>
        ) : (
          <button type="button" onClick={() => askHere(false)} className="text-ink-soft hover:underline">
            📍 내 위치 날씨
          </button>
        )}
        {isOwner && placeSearch && (
          <button
            ref={pickToggle}
            type="button"
            onClick={() => setPicking((v) => !v)}
            aria-expanded={picking}
            className="ml-auto max-w-[60%] truncate rounded-md px-1 text-ink-soft hover:bg-line/40"
            title={place ? place.name : undefined}
          >
            블로그 동네 <b className="text-ink">{home}</b> ✎
          </button>
        )}
        {isOwner && placeSearch && picking && <WeatherPlacePicker city={place ? null : city} onPlace={changePlace} onCity={changeCity} onClose={closePicker} />}
        {isOwner && !placeSearch && (
          <label className="ml-auto flex items-center gap-1 text-ink-soft">
            블로그 도시
            <select value={place ? "" : city} onChange={(e) => changeCity(e.target.value)} disabled={saving} className="rounded-md border border-line bg-surface px-1 py-0.5 text-ink">
              {/* 동네를 쓰는 중이면 지금 도시를 다시 골라도 바뀌게 빈 칸을 보여 준다 */}
              {place && (
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
        )}
        {note && (
          <p className="w-full text-xs text-ink-soft" role="status">
            {note}
          </p>
        )}
      </div>
      <p className="px-2 pt-1 text-right text-[11px] text-ink-soft">
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="hover:underline">
          Open-Meteo
        </a>{" "}
        예보 · 30분마다 새로 받아요
      </p>
    </section>
  );
}

function Dust({ pm10, pm25 }: { pm10: number | null; pm25: number | null }) {
  const a = dustGrade("pm10", pm10);
  const b = dustGrade("pm25", pm25);
  if (!a && !b) return null;
  return (
    <p className="text-sm" data-weather-dust>
      {a && (
        <>
          미세 <b className={DUST_TONE[a]}>{a}</b>
        </>
      )}
      {a && b && <span className="text-ink-soft"> · </span>}
      {b && (
        <>
          초미세 <b className={DUST_TONE[b]}>{b}</b>
        </>
      )}
    </p>
  );
}

/** 2시간 간격 5칸: 위에 기온 꺾은선, 아래 아이콘과 시각 (네이버 날씨 카드 모양) */
function Hours({ hours }: { hours: Weather["hours"] }) {
  const W = 50;
  const temps = hours.map((h) => h.temp);
  const hi = Math.max(...temps);
  const lo = Math.min(...temps);
  const y = (t: number) => (hi === lo ? 34 : 50 - ((t - lo) / (hi - lo)) * 30);
  const points = hours.map((h, i) => `${i * W + W / 2},${y(h.temp)}`).join(" ");
  return (
    <figure className="min-w-0" aria-label="시간대별 기온">
      <svg viewBox={`0 0 ${hours.length * W} 60`} className="w-full overflow-visible" role="img" aria-hidden>
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-soft/70" />
        {hours.map((h, i) => (
          <g key={h.time}>
            <line x1={i * W + W / 2} x2={i * W + W / 2} y1={y(h.temp) + 4} y2={60} stroke="currentColor" strokeWidth="0.5" className="text-line" />
            <text x={i * W + W / 2} y={y(h.temp) - 6} textAnchor="middle" fontSize="12" className="fill-current font-semibold tabular-nums">
              {Math.round(h.temp)}°
            </text>
          </g>
        ))}
      </svg>
      <ol className="grid text-center text-xs" style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}>
        {hours.map((h, i) => {
          const look = weatherLook(h.code, h.isDay);
          const hour = Number(h.time.slice(11, 13));
          return (
            <li key={h.time} className="flex flex-col items-center gap-0.5" data-weather-hour={h.time}>
              <span className="text-lg leading-none" title={look.label}>
                <span aria-hidden>{look.icon}</span>
              </span>
              <span className={i === 0 ? "font-bold" : "text-ink-soft"}>
                {i === 0 ? `${hour}시` : hour}
                <span className="sr-only">
                  {i === 0 ? "" : "시"} {Math.round(h.temp)}도 {look.label}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
