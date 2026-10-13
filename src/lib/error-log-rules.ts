// 서버 오류 기록의 순수 규칙 (server/error-log.ts, instrumentation.ts, 관리자 오류 화면).
// DB·Next 없이 단위 테스트한다 (tests/unit/error-log-rules.test.ts).

export const ERROR_LIMITS = { message: 1000, stack: 4000, stackLines: 30, userAgent: 300, url: 500, route: 200 } as const;
/** 같은 오류를 한 줄로 묶는 시간 */
export const GROUP_WINDOW_MS = 60 * 60 * 1000;
/** 이보다 오래된 줄은 지운다 */
export const RETENTION_DAYS = 30;
/** 기록할 때마다 이 확률로 오래된 줄을 지운다 (따로 도는 일 없이 표를 작게 유지) */
export const PRUNE_CHANCE = 0.01;
/** 기록이 요청을 붙잡는 최대 시간 */
export const RECORD_TIMEOUT_MS = 2000;

export const ERROR_RANGES = { "24h": "최근 24시간", "7d": "최근 7일", all: "전체" } as const;
export type ErrorRange = keyof typeof ERROR_RANGES;

export function parseErrorRange(value: unknown): ErrorRange {
  return typeof value === "string" && Object.hasOwn(ERROR_RANGES, value) ? (value as ErrorRange) : "24h";
}

/** 기간의 시작 시각 (전체면 null) */
export function rangeSince(range: ErrorRange, now = Date.now()): Date | null {
  if (range === "24h") return new Date(now - 24 * 60 * 60 * 1000);
  if (range === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000);
  return null;
}

/** max자를 넘으면 자르고 …를 붙인다 (결과도 max자 이하) */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

/** 경로만 남긴다: 쿼리 문자열(토큰이 들어 있을 수 있다)과 #뒤를 뗀다 */
export function stripQuery(path: string): string {
  const cut = path.search(/[?#]/);
  return cut === -1 ? path : path.slice(0, cut);
}

/** 비밀로 보이는 환경 값들 (8자 이상): 메시지·스택에 섞여 나오면 가린다 */
export function secretValues(env: Record<string, string | undefined>): string[] {
  return Object.entries(env)
    .filter(([key, value]) => value && value.length >= 8 && /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|CLIENT_ID/i.test(key))
    .map(([, value]) => value!);
}

export function redact(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const s of secrets) out = out.split(s).join("[숨김]");
  return out;
}

/** 스택은 앞 줄들만, 4000자 이하로 */
export function trimStack(stack: string, secrets: readonly string[] = []): string {
  const lines = redact(stack, secrets).split("\n").slice(0, ERROR_LIMITS.stackLines);
  return truncate(lines.join("\n"), ERROR_LIMITS.stack);
}

/** 묶는 열쇠: 같은 경로에서 digest가 같으면 (없으면 메시지가 같으면) 같은 오류 */
export function groupKey(e: { digest: string | null; message: string; routePath: string | null }): string {
  return `${e.routePath ?? "-"}|${e.digest ? `d:${e.digest}` : `m:${e.message}`}`;
}

type RequestInfo = { path: string; method: string; headers: Record<string, string | string[] | undefined> };
type ContextInfo = { routePath?: string; routeType?: string };

export type ErrorEntry = {
  digest: string | null;
  message: string;
  stack: string | null;
  routePath: string | null;
  routeType: string | null;
  method: string | null;
  url: string | null;
  userAgent: string | null;
};

/** onRequestError가 받은 값들을 저장할 한 줄로 (자르기·쿼리 떼기·비밀 가리기) */
export function toErrorEntry(err: unknown, request: RequestInfo, context: ContextInfo, secrets: readonly string[] = []): ErrorEntry {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const digest = typeof err === "object" && err !== null && "digest" in err && err.digest != null ? String(err.digest).slice(0, 100) : null;
  const stack = err instanceof Error && err.stack ? trimStack(err.stack, secrets) : null;
  const ua = request.headers["user-agent"];
  const userAgent = Array.isArray(ua) ? ua[0] : ua;
  return {
    digest,
    message: truncate(redact(rawMessage, secrets) || "(메시지 없음)", ERROR_LIMITS.message),
    stack,
    routePath: context.routePath ? truncate(context.routePath, ERROR_LIMITS.route) : null,
    routeType: context.routeType ?? null,
    method: request.method ? request.method.slice(0, 10) : null,
    url: request.path ? truncate(stripQuery(request.path), ERROR_LIMITS.url) : null,
    userAgent: userAgent ? truncate(userAgent, ERROR_LIMITS.userAgent) : null,
  };
}

export const ROUTE_TYPES: Record<string, string> = { render: "화면", route: "라우트", action: "서버 액션", proxy: "프록시" };
