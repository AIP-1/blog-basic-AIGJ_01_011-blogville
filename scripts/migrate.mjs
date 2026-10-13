// 운영 컨테이너가 시작할 때 쓰는 DB 마이그레이션 (Dockerfile CMD).
// drizzle-kit migrate와 같은 drizzle/ 폴더·기록 테이블(drizzle.__drizzle_migrations)을 쓰지만,
// 실패하면 DB 오류 코드와 문구를 그대로 보여 준다.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
  console.log("마이그레이션 완료");
} catch (e) {
  const c = e.cause ?? e;
  console.error("마이그레이션 실패:", c.code ?? "", c.message);
  if (c.detail) console.error("자세히:", c.detail);
  if (c.hint) console.error("도움말:", c.hint);
  if (e.query) console.error("문장:", e.query.slice(0, 300));
  process.exitCode = 1;
} finally {
  await sql.end();
}
