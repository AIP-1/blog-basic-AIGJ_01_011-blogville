"use server";

import { revalidatePath } from "next/cache";
import type { WeatherPlace } from "@/lib/weather-place";
import { getMyBlog, requireMember } from "@/server/dal";
import { setBlogWeatherCity } from "@/server/weather";
import { searchWeatherPlaces, setBlogWeatherPlace } from "@/server/weather-place";

/** ☀️ 날씨 위젯의 도시 바꾸기 (블로그 주인만, 위젯 안에서 바로) */
export async function saveWeatherCity(city: string): Promise<{ ok: boolean }> {
  const member = await requireMember();
  const ok = await setBlogWeatherCity(member.userId, city);
  if (ok) revalidatePath(`/blog/${(await getMyBlog(member.userId)).slug}`, "layout");
  return { ok };
}

/** ☀️ 날씨 동네 찾기 (블로그 주인이 위젯에서). 못 찾거나 실패하면 ok:false */
export async function findWeatherPlaces(query: string): Promise<{ ok: boolean; places: WeatherPlace[] }> {
  await requireMember();
  if (typeof query !== "string") return { ok: false, places: [] };
  try {
    return { ok: true, places: await searchWeatherPlaces(query) };
  } catch {
    return { ok: false, places: [] };
  }
}

/** ☀️ 날씨 동네 정하기: 고른 결과의 좌표만 받고 이름은 서버가 다시 확인한다 */
export async function saveWeatherPlace(lat: number, lon: number): Promise<{ place: WeatherPlace | null }> {
  const member = await requireMember();
  if (typeof lat !== "number" || typeof lon !== "number") return { place: null };
  const place = await setBlogWeatherPlace(member.userId, lat, lon);
  if (place) revalidatePath(`/blog/${(await getMyBlog(member.userId)).slug}`, "layout");
  return { place };
}
