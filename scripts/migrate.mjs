// 운영 컨테이너가 시작할 때 쓰는 DB 마이그레이션 (Dockerfile CMD).
// drizzle-kit migrate와 같은 drizzle/ 폴더를 같은 방식(drizzle-orm의 migrate와 같은 순서·기록)으로 적용하되,
// - 운영 DB 계정은 데이터베이스에 스키마를 만들 권한이 없을 수 있어서 CREATE SCHEMA를 하지 않고
//   기록 테이블(__drizzle_migrations)을 DATABASE_URL의 search_path 스키마(없으면 public)에 둔다.
// - 그 스키마가 public이 아니면 SQL 안의 "public". 을 그 스키마로 바꿔 적용한다.
// - 실패하면 DB 오류 코드와 문구를 그대로 보여 준다.
import postgres from "postgres";
import { readMigrationFiles } from "drizzle-orm/migrator";

const url = new URL(process.env.DATABASE_URL);
const schema = (url.searchParams.get("search_path") ?? "public").split(",")[0].trim() || "public";
const ident = (s) => `"${s.replaceAll('"', '""')}"`;
const table = `${ident(schema)}."__drizzle_migrations"`;
const rewrite = (stmt) => (schema === "public" ? stmt : stmt.replaceAll('"public".', `${ident(schema)}.`));

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
let current = "";
try {
  const migrations = readMigrationFiles({ migrationsFolder: "drizzle" });
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS ${table} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`);
  const [last] = await sql.unsafe(`select created_at from ${table} order by created_at desc limit 1`);
  const pending = migrations.filter((m) => !last || Number(last.created_at) < m.folderMillis);
  await sql.begin(async (tx) => {
    for (const m of pending) {
      for (const stmt of m.sql) {
        current = rewrite(stmt);
        if (current.trim()) await tx.unsafe(current);
      }
      await tx.unsafe(`insert into ${table} ("hash", "created_at") values ($1, $2)`, [m.hash, m.folderMillis]);
    }
  });
  console.log(`마이그레이션 완료 (스키마 ${schema}, 새로 적용 ${pending.length}개)`);
} catch (e) {
  console.error("마이그레이션 실패:", e.code ?? "", e.message);
  if (e.detail) console.error("자세히:", e.detail);
  if (e.hint) console.error("도움말:", e.hint);
  if (current) console.error("문장:", current.trim().slice(0, 300));
  process.exitCode = 1;
} finally {
  await sql.end();
}
