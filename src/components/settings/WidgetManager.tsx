"use client";

import { useActionState, useRef, useState } from "react";
import { saveWidgetLayout, type SettingsState } from "@/app/settings/blog/actions";
import { defaultLayout, dropWidget, moveWidget, WEATHER_CITIES, widgetInfo, type WeatherCityKey, type WidgetItem, type WidgetKey, type WidgetLayout } from "@/lib/widgets";

/**
 * 블로그 관리 → 🧩 위젯 관리: 끌어서(또는 ▲▼로) 순서를 바꾸고, 보이기·크기를 고른 뒤 [저장].
 * 끌어 놓기는 마우스용이고, 휴대폰·키보드는 ▲▼ 버튼을 쓴다.
 */
export function WidgetManager({ layout }: { layout: WidgetLayout }) {
  const [items, setItems] = useState<WidgetItem[]>(layout.items);
  const [city, setCity] = useState<WeatherCityKey>(layout.weather.city);
  const [dragging, setDragging] = useState<WidgetKey | null>(null);
  // 끌기 시작한 위젯 (렌더를 기다리지 않고 dragover·drop에서 바로 읽는다)
  const dragKey = useRef<WidgetKey | null>(null);
  const [over, setOver] = useState<WidgetKey | null>(null);
  const [announce, setAnnounce] = useState("");
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveWidgetLayout, null);

  const update = (key: WidgetKey, patch: Partial<WidgetItem>) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  const move = (key: WidgetKey, delta: -1 | 1) => {
    const next = moveWidget(items, key, delta);
    setItems(next);
    setAnnounce(`${widgetInfo(key).label}: ${next.findIndex((it) => it.key === key) + 1}번째`);
  };

  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-ink-soft">블로그 홈 옆 칸에 보일 위젯의 순서와 크기를 골라요. 끌어서 옮기거나 ▲▼를 누르세요.</p>
      <input type="hidden" name="layout" value={JSON.stringify({ items, weather: { city } })} />
      <ol className="space-y-2" data-widget-manager>
        {items.map((it, i) => {
          const info = widgetInfo(it.key);
          return (
            <li
              key={it.key}
              data-widget-row={it.key}
              draggable
              onDragStart={(e) => {
                dragKey.current = it.key;
                setDragging(it.key);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", it.key);
              }}
              onDragOver={(e) => {
                if (!dragKey.current) return;
                e.preventDefault();
                setOver(it.key);
              }}
              onDragLeave={() => setOver((o) => (o === it.key ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragKey.current;
                if (from) setItems((list) => dropWidget(list, from, it.key));
                dragKey.current = null;
                setDragging(null);
                setOver(null);
              }}
              onDragEnd={() => {
                dragKey.current = null;
                setDragging(null);
                setOver(null);
              }}
              className={`flex flex-wrap items-center gap-2 rounded-xl border bg-surface px-3 py-2 transition ${
                over === it.key && dragging !== it.key ? "border-accent ring-2 ring-accent/30" : "border-line"
              } ${dragging === it.key ? "opacity-50" : ""} ${it.visible ? "" : "bg-bg"}`}
            >
              <span aria-hidden className="cursor-grab select-none text-ink-soft max-sm:hidden" title="끌어서 옮기기">
                ⠿
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={`font-semibold ${it.visible ? "" : "text-ink-soft line-through"}`}>
                  <span aria-hidden>{info.icon}</span> {info.label}
                </span>
                <span className="text-xs text-ink-soft">{info.hint}</span>
              </span>
              {info.sizable && (
                <span role="group" aria-label={`${info.label} 크기`} className="inline-flex overflow-hidden rounded-lg border border-line text-sm">
                  {(["sm", "lg"] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      aria-pressed={it.size === size}
                      onClick={() => update(it.key, { size })}
                      className={`min-h-11 min-w-11 px-3 ${it.size === size ? "bg-ink text-surface" : "hover:bg-bg"}`}
                    >
                      {size === "sm" ? "작게" : "크게"}
                    </button>
                  ))}
                </span>
              )}
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 px-1 text-sm">
                <input type="checkbox" checked={it.visible} onChange={(e) => update(it.key, { visible: e.target.checked })} className="size-4 accent-[var(--accent)]" />
                보이기
              </label>
              <span className="inline-flex">
                <button type="button" className="btn btn-ghost min-w-11 px-2" aria-label={`${info.label} 위로`} disabled={i === 0} onClick={() => move(it.key, -1)}>
                  ▲
                </button>
                <button type="button" className="btn btn-ghost min-w-11 px-2" aria-label={`${info.label} 아래로`} disabled={i === items.length - 1} onClick={() => move(it.key, 1)}>
                  ▼
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">🌤️ 날씨 기본 도시</span>
        <select value={city} onChange={(e) => setCity(e.target.value as WeatherCityKey)} className="field w-auto" name="weatherCity">
          {WEATHER_CITIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <span className="text-ink-soft">방문자가 📍 내 위치를 누르면 그 위치 날씨로 바뀌어요</span>
      </label>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {state?.error ? (
          <p role="alert" className="form-error">
            {state.error}
          </p>
        ) : state?.message ? (
          <p role="status" className="font-semibold text-accent">
            {state.message}
          </p>
        ) : null}
        <button
          type="submit"
          name="reset"
          value="1"
          className="btn btn-ghost"
          disabled={pending}
          onClick={() => {
            const base = defaultLayout();
            setItems(base.items);
            setCity(base.weather.city);
          }}
        >
          기본 배치로
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          위젯 배치 저장
        </button>
      </div>
    </form>
  );
}
