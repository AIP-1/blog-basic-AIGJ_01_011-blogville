// SC-003, NF-07: 글이 1,000개인 블로그의 홈 응답 시간을 잰다.
// 서버를 먼저 띄워 둔다 (npm run build && npm start 권장). BASE_URL로 주소를 바꿀 수 있다.
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const POSTS = 1000;
const RUNS = 20;
const LIMIT_MS = 1000;

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function time(url: string) {
  const start = performance.now();
  const res = await fetch(url);
  await res.text();
  if (res.status !== 200) throw new Error(`${url} → ${res.status}`);
  return performance.now() - start;
}

function summary(ms: number[]) {
  const sorted = [...ms].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return { median: at(0.5), p95: at(0.95) };
}

async function main() {
  const userId = randomBytes(16).toString("hex");
  const slug = `perf_${randomBytes(4).toString("hex")}`;
  try {
    await sql`insert into users (id, username, email, name) values (${userId}, ${slug}, ${`${slug}@perf.local`}, ${slug})`;
    await sql`insert into profiles (user_id, nickname) values (${userId}, ${slug})`;
    const [blog] = await sql`insert into blogs (owner_id, slug, title) values (${userId}, ${slug}, '성능 측정') returning id`;
    await sql`insert into posts (blog_id, title, content_html, content_text, created_at)
      select ${blog.id}, '글 ' || n, '<p>본문 ' || n || '</p>', '본문 ' || n, now() - make_interval(mins => ${POSTS} - n)
      from generate_series(1, ${POSTS}) n`;

    const lastPage = Math.ceil(POSTS / 8);
    let failed = false;
    for (const path of [`/@${slug}`, `/@${slug}?page=${lastPage}`]) {
      const url = BASE_URL + path;
      await time(url); // 첫 컴파일·캐시 데우기
      const ms: number[] = [];
      for (let i = 0; i < RUNS; i++) ms.push(await time(url));
      const { median, p95 } = summary(ms);
      const ok = p95 < LIMIT_MS;
      failed ||= !ok;
      console.log(`${ok ? "✓" : "✗"} ${path}  중앙값 ${median.toFixed(0)}ms  p95 ${p95.toFixed(0)}ms  (기준 ${LIMIT_MS}ms)`);
    }
    process.exitCode = failed ? 1 : 0;
  } finally {
    await sql`delete from users where id = ${userId}`;
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
