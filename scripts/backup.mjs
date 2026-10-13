// DB 백업 (deploy/backup.sh가 앱 이미지로 띄운 일회용 컨테이너 안에서 부른다).
// DATABASE_URL의 search_path 스키마(없으면 public)에 있는 모든 표를 표마다 JSON 줄(한 줄에 한 행, gzip)로 BACKUP_DIR에 쓴다.
// pg_dump 없이 SELECT만 쓰므로 스키마를 만들 권한이 없는 계정으로도 된다. 표 구조는 drizzle/ 마이그레이션이 기록이다.
// 되살리기: 같은 마이그레이션까지 적용한 빈 스키마에 표마다 줄을 읽어 INSERT (외래 키 순서 주의, manifest.json의 행 수로 확인).
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import postgres from "postgres";

const url = new URL(process.env.DATABASE_URL);
const schema = (url.searchParams.get("search_path") ?? "public").split(",")[0].trim() || "public";
const dir = process.env.BACKUP_DIR;
if (!dir) throw new Error("BACKUP_DIR이 없어요");
mkdirSync(dir, { recursive: true });

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ident = (s) => `"${s.replaceAll('"', '""')}"`;
try {
  const tables = await sql`select table_name from information_schema.tables where table_schema = ${schema} and table_type = 'BASE TABLE' order by table_name`;
  const counts = {};
  for (const { table_name: t } of tables) {
    // 1000행씩 나눠 읽는다 (이 블로그 규모에서는 표 하나를 메모리에 모아 써도 충분하다)
    const lines = [];
    for await (const rows of sql.unsafe(`select * from ${ident(schema)}.${ident(t)}`).cursor(1000)) {
      for (const r of rows) lines.push(JSON.stringify(r));
    }
    counts[t] = lines.length;
    writeFileSync(path.join(dir, `${t}.jsonl.gz`), gzipSync(lines.join("\n")));
  }
  const [{ last }] = await sql.unsafe(`select max(created_at) as last from ${ident(schema)}."__drizzle_migrations"`).catch(() => [{ last: null }]);
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ createdAt: new Date().toISOString(), schema, lastMigration: last, rows: counts }, null, 2));
  console.log(`백업 완료: 표 ${tables.length}개, 행 ${Object.values(counts).reduce((a, b) => a + b, 0)}개`);
} catch (e) {
  console.error("백업 실패:", e.code ?? "", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
