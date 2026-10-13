import type { Instrumentation } from "next";

// 서버가 켜질 때 한 번 (Next instrumentation). 예약 발행 같은 정해진 시각의 일을 돌린다.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // 빌드 중(정적 화면 미리 그리기)에는 돌리지 않는다
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { startScheduler } = await import("./server/scheduler");
  startScheduler();
}

/**
 * 처리 못 한 서버 오류(화면·라우트·서버 액션)를 error_logs에 남긴다 (관리자 ⚠️ 오류 화면).
 * 기록이 실패해도 절대 던지지 않고, 최대 RECORD_TIMEOUT_MS만 기다린다 (그 뒤엔 기록이 혼자 끝나게 둔다).
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { RECORD_TIMEOUT_MS, secretValues, toErrorEntry } = await import("./lib/error-log-rules");
    const { recordError } = await import("./server/error-log");
    const entry = toErrorEntry(err, request, context, secretValues(process.env));
    const work = recordError(entry).catch((e: unknown) => console.error("오류 기록 실패", e));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, RECORD_TIMEOUT_MS);
    });
    await Promise.race([work, timeout]);
    clearTimeout(timer);
  } catch (e) {
    console.error("오류 기록 실패", e);
  }
};
