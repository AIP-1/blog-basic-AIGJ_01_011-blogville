import { getPostCalendar } from "@/server/calendar";
import { getWeather } from "@/server/weather";
import { todayParts } from "@/lib/calendar";
import { weatherCity, type WeatherCityKey, type WidgetSize } from "@/lib/widgets";
import { CalendarWidget } from "./CalendarWidget";
import { WeatherWidget } from "./WeatherWidget";

// 옆 칸에서 서버가 첫 화면을 그려 보내는 위젯들. Suspense 안에서 쓴다 — 바깥 서비스를 기다리느라 블로그 홈이 늦게 뜨지 않게

export async function BlogCalendar({ blogId, slug, size }: { blogId: number; slug: string; size: WidgetSize }) {
  const t = todayParts();
  const initial = await getPostCalendar(blogId, t.year, t.month);
  return <CalendarWidget slug={slug} initial={initial} size={size} />;
}

export async function BlogWeather({ city, size }: { city: WeatherCityKey; size: WidgetSize }) {
  const c = weatherCity(city);
  const initial = await getWeather(c.lat, c.lon, c.label);
  return <WeatherWidget city={city} initial={initial} size={size} />;
}
