import { publishDuePosts } from "./post";

// 서버 안에서 30초마다 도는 일 (instrumentation.ts가 켠다). 지금은 예약 발행(개선 11)만.
const EVERY_MS = 30_000;

let started = false;

export function startScheduler() {
  if (started) return;
  started = true;
  const tick = async () => {
    try {
      const n = await publishDuePosts();
      if (n > 0) console.log(`예약 글 ${n}개를 공개했어요`);
    } catch (error) {
      console.error("예약 발행 실패", error);
    }
  };
  setInterval(tick, EVERY_MS).unref();
  void tick();
}
