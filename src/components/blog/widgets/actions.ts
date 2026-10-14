"use server";

import { revalidatePath } from "next/cache";
import { getMyBlog, requireMember } from "@/server/dal";
import { setBlogWeatherCity } from "@/server/weather";

/** ☀️ 날씨 위젯의 도시 바꾸기 (블로그 주인만, 위젯 안에서 바로) */
export async function saveWeatherCity(city: string): Promise<{ ok: boolean }> {
  const member = await requireMember();
  const ok = await setBlogWeatherCity(member.userId, city);
  if (ok) revalidatePath(`/blog/${(await getMyBlog(member.userId)).slug}`, "layout");
  return { ok };
}
