// 서버가 켜질 때 한 번 (Next instrumentation). 예약 발행 같은 정해진 시각의 일을 돌린다.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // 빌드 중(정적 화면 미리 그리기)에는 돌리지 않는다
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { startScheduler } = await import("./server/scheduler");
  startScheduler();
}
