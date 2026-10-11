/**
 * 쓰이지 않는 첨부와 어제보다 오래된 조회 기록 정리 (POST-07, POST-06). 하루에 한 번 손으로 돌린다.
 *   npm run posts:cleanup            지운다
 *   npm run posts:cleanup -- --dry-run   세기만 한다
 */
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  // DATABASE_URL을 읽은 뒤에 불러온다
  const { cleanupAttachments } = await import("../src/server/attachments");
  const { cleanupPostViews } = await import("../src/server/stats");
  const result = await cleanupAttachments({ dryRun });
  const views = await cleanupPostViews({ dryRun });
  const verb = dryRun ? "지울" : "지운";
  console.log(`${verb} 첨부: ${result.attachments}개`);
  console.log(`${verb} 주인 없는 파일: ${result.orphans}개`);
  console.log(`${verb} 지난 조회 기록: ${views}줄`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
