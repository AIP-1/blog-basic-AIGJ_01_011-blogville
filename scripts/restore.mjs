// DB 백업 되살리기 (scripts/backup.mjs가 만든 폴더 → 빈 스키마).
//   DATABASE_URL=… node scripts/migrate.mjs                 # 먼저 빈 스키마에 같은 마이그레이션까지 적용
//   DATABASE_URL=… node scripts/restore.mjs <백업 폴더>       # 그다음 되살리기
// 안전장치: 되살릴 스키마에 회원(users)이 한 명이라도 있으면 아무것도 하지 않는다(운영 데이터를 덮어쓰지 않게).
// 마이그레이션이 미리 넣는 기본 자료(아이템·출석 보상 등)는 지우고 백업 내용으로 바꾼다.
// 외래 키 순서대로(참조되는 표 먼저) 표마다 넣고, 번호(identity)는 그대로 살린 뒤 다음 번호를 맞춘다.
// 전부 한 트랜잭션이라 중간에 실패하면 아무것도 남지 않는다. 끝나면 표마다 manifest.json의 행 수와 비교한다.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import postgres from "postgres";

const dir = process.argv[2];
if (!dir) {
  console.error("사용법: node scripts/restore.mjs <백업 폴더>");
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));
const url = new URL(process.env.DATABASE_URL);
const schema = (url.searchParams.get("search_path") ?? "public").split(",")[0].trim() || "public";
const ident = (s) => `"${s.replaceAll('"', '""')}"`;
const q = (t) => `${ident(schema)}.${ident(t)}`;
const SKIP = new Set(["__drizzle_migrations"]); // 마이그레이션 기록은 migrate.mjs가 만든다

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  const tables = (await sql`select table_name from information_schema.tables where table_schema = ${schema} and table_type = 'BASE TABLE'`)
    .map((r) => r.table_name)
    .filter((t) => !SKIP.has(t));
  const missing = Object.keys(manifest.rows).filter((t) => !SKIP.has(t) && !tables.includes(t));
  if (missing.length) throw new Error(`백업에는 있는데 DB에 없는 표: ${missing.join(", ")} (마이그레이션을 먼저 적용하세요)`);

  const [{ members }] = await sql.unsafe(`select count(*)::int as members from ${q("users")}`);
  if (members > 0) throw new Error(`회원이 이미 ${members}명 있어요. 회원이 없는 새 스키마에만 되살릴 수 있어요`);

  // 외래 키: 자식 → 부모. 부모를 먼저 넣는다 (자기 자신을 가리키는 키는 순서에서 뺀다)
  const fks = await sql`
    select c.relname as child, p.relname as parent
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid join pg_namespace cn on cn.oid = c.relnamespace
    join pg_class p on p.oid = k.confrelid
    where k.contype = 'f' and cn.nspname = ${schema} and c.relname <> p.relname`;
  const order = [];
  const done = new Set();
  const visiting = new Set();
  const visit = (t) => {
    if (done.has(t)) return;
    if (visiting.has(t)) throw new Error(`외래 키가 돌고 있어 순서를 정할 수 없어요: ${t}`);
    visiting.add(t);
    for (const f of fks) if (f.child === t && tables.includes(f.parent)) visit(f.parent);
    visiting.delete(t);
    done.add(t);
    order.push(t);
  };
  [...tables].sort((a, b) => a.localeCompare(b)).forEach(visit);

  const identity = await sql`
    select table_name, column_name from information_schema.columns
    where table_schema = ${schema} and is_identity = 'YES'`;

  await sql.begin(async (tx) => {
    // 마이그레이션이 넣은 기본 자료를 자식 표부터 지운다 (회원이 없으니 회원 자료는 없다)
    for (const t of [...order].reverse()) await tx.unsafe(`delete from ${q(t)}`);
    for (const t of order) {
      const expected = manifest.rows[t] ?? 0;
      if (!expected) continue;
      const text = gunzipSync(readFileSync(path.join(dir, `${t}.jsonl.gz`))).toString("utf8");
      const rows = text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
      // 1000행씩: JSON을 그 표의 행 모양으로 바꿔 넣는다. 번호는 백업 그대로 (OVERRIDING SYSTEM VALUE)
      for (let i = 0; i < rows.length; i += 1000) {
        const chunk = rows.slice(i, i + 1000);
        const cols = Object.keys(chunk[0]).map(ident).join(", ");
        await tx.unsafe(
          `insert into ${q(t)} (${cols}) overriding system value select ${cols} from json_populate_recordset(null::${q(t)}, $1::text::json)`,
          [JSON.stringify(chunk)],
        );
      }
    }
    // 다음 번호를 되살린 최댓값 뒤로
    for (const { table_name: t, column_name: c } of identity) {
      if (SKIP.has(t)) continue;
      await tx.unsafe(`select setval(pg_get_serial_sequence('${q(t).replaceAll("'", "''")}', '${c.replaceAll("'", "''")}'), coalesce((select max(${ident(c)}) from ${q(t)}), 0) + 1, false)`);
    }
  });

  let bad = 0;
  for (const t of order) {
    const [{ n }] = await sql.unsafe(`select count(*)::int as n from ${q(t)}`);
    const expected = manifest.rows[t] ?? 0;
    if (n !== expected) {
      bad++;
      console.error(`  ✗ ${t}: 백업 ${expected}행, 되살린 ${n}행`);
    }
  }
  const total = order.reduce((s, t) => s + (manifest.rows[t] ?? 0), 0);
  if (bad) throw new Error(`행 수가 다른 표가 ${bad}개 있어요`);
  console.log(`되살리기 완료: 표 ${order.length}개, 행 ${total}개 (백업 시각 ${manifest.createdAt}, 스키마 ${schema})`);
} catch (e) {
  console.error("되살리기 실패:", e.code ?? "", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
