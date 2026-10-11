import "server-only";
import { cookies } from "next/headers";

// 방문자 쿠키 (POST-06·BLOG-06). 회원 정보와 잇지 않은 무작위 UUID.
const COOKIE = "bv_visitor";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 서버 컴포넌트에서 읽기만. 없거나 형식이 틀리면 null. */
export async function readVisitorId(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  return value && UUID_RE.test(value) ? value : null;
}

/** Server Action에서만: 없거나 형식이 틀리면 새로 만들어 심는다. */
export async function ensureVisitorId(): Promise<string> {
  const current = await readVisitorId();
  if (current) return current;
  const id = crypto.randomUUID();
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });
  return id;
}
