import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

const handler = toNextJsHandler(auth);

// 가입·로그인·로그아웃은 Server Action으로만 한다 (시도 제한·가입 트랜잭션을 건너뛰지 못하게, NF-12).
// 라이브러리 HTTP 경로는 세션 조회만 연다.
const ALLOWED_GET = new Set(["/api/auth/get-session"]);

const notFound = () => new Response("Not Found", { status: 404 });

export async function GET(request: Request) {
  const { pathname } = new URL(request.url);
  return ALLOWED_GET.has(pathname) ? handler.GET(request) : notFound();
}

export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
