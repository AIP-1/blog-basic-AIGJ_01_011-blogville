import { sql } from "drizzle-orm";
import { db } from "@/db";
import { version } from "../../../../package.json";

// 상태 확인 (도커 HEALTHCHECK, MSA 실습 게이트웨이, 바깥 감시가 부른다). 누구나.
// DB에 `select 1`을 해 보고, 되면 200 {"status":"UP"}, 안 되면 503 {"status":"DOWN"}. 비밀 값은 내보내지 않는다.
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  let dbUp = false;
  try {
    await Promise.race([db.execute(sql`select 1`), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2_000))]);
    dbUp = true;
  } catch {
    dbUp = false;
  }
  const body = { status: dbUp ? "UP" : "DOWN", service: "blogville", version, db: dbUp ? "UP" : "DOWN", ms: Date.now() - started };
  return Response.json(body, { status: dbUp ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
