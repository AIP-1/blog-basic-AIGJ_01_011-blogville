import { cityOf, isCityKey, roundCoord } from "@/lib/weather";
import { getDong, getWeather } from "@/server/weather";

// ☀️ 날씨 위젯이 부른다. 누구나 (방문자도 본다).
//   ?lat=&lon=  보는 사람이 위치를 허락했을 때 (0.1도로 줄여 쓴다)
//   ?city=busan 고를 수 있는 도시 (위젯이 블로그 주인이 고른 도시로 부른다)
// 자료는 서버가 30분 기억하니 브라우저도 5분은 다시 묻지 않는다.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  let place: { lat: number; lon: number; name: string | null; city: string | null; full?: string | null } | null = null;
  if (params.has("lat") && params.has("lon")) {
    const at = roundCoord(Number(params.get("lat")), Number(params.get("lon")));
    if (at) place = { ...at, name: null, city: null };
  } else if (isCityKey(params.get("city"))) {
    const city = cityOf(params.get("city"));
    place = { lat: city.lat, lon: city.lon, name: city.name, city: city.key };
  }
  if (!place) return Response.json({ error: "어느 곳의 날씨인지 몰라요" }, { status: 400 });
  // 내 위치면 동 이름도 ("상무1동"). 못 받아도 날씨는 보여 준다
  const [weather, dong] = await Promise.all([getWeather(place.lat, place.lon), place.city ? null : getDong(place.lat, place.lon)]);
  if (dong) place = { ...place, name: dong.dong, full: dong.full };
  if (!weather) return Response.json({ error: "날씨를 받지 못했어요" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return Response.json({ place: { name: place.name, city: place.city, full: place.full ?? null }, weather }, { headers: { "Cache-Control": "public, max-age=300" } });
}
