import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { enabledProviders } from "@/lib/social-login";

const handler = toNextJsHandler(auth);

// 가입·로그인·로그아웃은 Server Action으로만 한다 (시도 제한·가입 트랜잭션을 건너뛰지 못하게, NF-12).
// 라이브러리 HTTP 경로는 세션 조회와, 키가 있는 소셜 서비스의 로그인·연동 콜백만 연다 (AUTH-01·05).
// 소셜 로그인·연동을 시작하는 경로(/sign-in/social, /link-social)는 열지 않고 Server Action이 부른다.
const ALLOWED_GET = new Set([
  "/api/auth/get-session",
  ...enabledProviders(process.env).map((p) => `/api/auth/callback/${p.id}`),
]);

const notFound = () => new Response("Not Found", { status: 404 });

export async function GET(request: Request) {
  const { pathname } = new URL(request.url);
  return ALLOWED_GET.has(pathname) ? handler.GET(request) : notFound();
}

export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
