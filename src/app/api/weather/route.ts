import { checkCoords } from "@/lib/weather";
import { isWeatherCity, weatherCity } from "@/lib/widgets";
import { getWeather, placeName } from "@/server/weather";

// 🌤️ 날씨 위젯: ?city=seoul (블로그 기본 도시) 또는 ?lat=..&lon=.. (방문자가 📍 내 위치를 눌렀을 때). 누구나.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const city = q.get("city");
  let weather;
  if (city !== null) {
    if (!isWeatherCity(city)) return Response.json({ error: "bad request" }, { status: 400 });
    const c = weatherCity(city);
    weather = await getWeather(c.lat, c.lon, c.label);
  } else {
    const at = checkCoords(q.get("lat"), q.get("lon"));
    if (!at) return Response.json({ error: "bad request" }, { status: 400 });
    const [place] = await Promise.all([placeName(at.lat, at.lon)]);
    weather = await getWeather(at.lat, at.lon, place ?? "내 위치");
  }
  if (!weather) return Response.json({ error: "unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  return Response.json(weather, { headers: { "Cache-Control": "private, max-age=600" } });
}
