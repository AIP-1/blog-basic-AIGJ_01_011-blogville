// 운영 서버 점검용 (status 워크플로가 앱 컨테이너 안에서 부른다). 아무것도 바꾸지 않고, 값 대신 예/아니요만 찍는다.
// ADMIN_USERNAME 계정이 있는지, 관리자 권한·로그인 수단·블로그가 있는지, ADMIN_PASSWORD가 저장된 비밀번호와 맞는지, 로그인 잠금 중인지.
import postgres from "postgres";
import { verifyPassword } from "better-auth/crypto";

const username = (process.env.ADMIN_USERNAME ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";
const yes = (b) => (b ? "예" : "아니요");
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  const [{ admins }] = await sql`select count(*)::int as admins from users where role = 'admin'`;
  console.log(`관리자 권한 계정 수: ${admins}`);
  if (!username) {
    console.log("ADMIN_USERNAME 시크릿이 없어요");
  } else {
    const [u] = await sql`select id, role from users where username = ${username}`;
    console.log(`ADMIN_USERNAME 계정이 있음: ${yes(u)}`);
    if (u) {
      const [acc] = await sql`select password from accounts where user_id = ${u.id} and provider_id = 'credential'`;
      const [blog] = await sql`select slug from blogs where owner_id = ${u.id}`;
      const [lock] = await sql`select failures, locked_until > now() as locked from login_attempts where username = ${username}`;
      console.log(`권한이 admin: ${yes(u.role === "admin")}`);
      console.log(`아이디·비밀번호 로그인 수단: ${yes(acc?.password)}`);
      console.log(`ADMIN_PASSWORD가 저장된 비밀번호와 맞음: ${acc?.password ? yes(await verifyPassword({ hash: acc.password, password })) : "확인 못 함"}`);
      console.log(`블로그(헤더 👑 버튼은 블로그가 있어야 보임): ${blog ? `있음 (/@${blog.slug})` : "없음"}`);
      console.log(`로그인 잠금 중: ${yes(lock?.locked)} (최근 연속 실패 ${lock?.failures ?? 0}번)`);
    }
  }
} catch (e) {
  console.error("점검 실패:", e.code ?? "", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
