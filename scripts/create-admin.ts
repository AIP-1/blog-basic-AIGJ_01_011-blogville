/**
 * 관리자 계정과 공지 블로그를 만들거나 갱신한다 (AUTH-08). 여러 번 실행해도 안전하다.
 * `.env.local`의 ADMIN_USERNAME, ADMIN_PASSWORD(12~64자, 아이디와 달라야 함)를 쓴다.
 * - 아이디가 없으면: 회원·로그인 수단·프로필(닉네임 `관리자`)·공지 블로그(`/@notice`, 대분류 `공지`)를 만든다.
 * - 아이디가 있으면: 비밀번호와 권한(admin)만 갱신하고, 공지 블로그가 없을 때만 만든다.
 */
import { config } from "dotenv";
import { hashPassword } from "better-auth/crypto";
import postgres from "postgres";

config({ path: ".env.local" });

const NOTICE = { slug: "notice", title: "Blogville 공지사항", intro: "마을 소식과 업데이트를 알려드려요", category: "공지", nickname: "관리자" };

class AdminError extends Error {}

function fail(message: string): never {
  throw new AdminError(message);
}

async function main() {
  const username = (process.env.ADMIN_USERNAME ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!/^[a-z0-9_]{4,20}$/.test(username)) fail("ADMIN_USERNAME은 영문 소문자, 숫자, _ 로 4~20자여야 해요.");
  if (password.length < 12 || password.length > 64) fail("ADMIN_PASSWORD는 12~64자여야 해요.");
  if (password === username) fail("ADMIN_PASSWORD는 아이디와 달라야 해요.");

  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const newId = () => crypto.randomUUID().replace(/-/g, "");
  const hash = await hashPassword(password);
  try {
    await sql.begin(async (tx) => {
      let [user] = await tx`select id from users where username = ${username} for update`;
      if (user) {
        await tx`update users set role = 'admin', updated_at = now() where id = ${user.id}`;
        const updated = await tx`update accounts set password = ${hash}, updated_at = now() where user_id = ${user.id} and provider_id = 'credential' returning id`;
        if (updated.length === 0) {
          await tx`insert into accounts (id, user_id, account_id, provider_id, password) values (${newId()}, ${user.id}, ${user.id}, 'credential', ${hash})`;
        }
        console.log(`${username}: 비밀번호와 관리자 권한을 갱신했어요.`);
      } else {
        const id = newId();
        await tx`insert into users (id, username, display_username, email, name, role)
          values (${id}, ${username}, ${username}, ${`${username}@users.blogville.invalid`}, ${username}, 'admin')`;
        await tx`insert into accounts (id, user_id, account_id, provider_id, password) values (${newId()}, ${id}, ${id}, 'credential', ${hash})`;
        const [taken] = await tx`select 1 from profiles where nickname = ${NOTICE.nickname}`;
        // 관리자도 남자 주민을 받아 장착한다 (GAME-01)
        await tx`insert into user_items (user_id, item_id) select ${id}, id from items where code = 'char_boy'`;
        await tx`insert into profiles (user_id, nickname, character_item_id) values (${id}, ${taken ? username : NOTICE.nickname}, (select id from items where code = 'char_boy'))`;
        user = { id };
        console.log(`${username}: 관리자 계정을 만들었어요.`);
      }
      const [owned] = await tx`select id from blogs where owner_id = ${user.id}`;
      if (owned) return;
      const [notice] = await tx`select 1 from blogs where slug = ${NOTICE.slug}`;
      if (notice) fail("공지 블로그 주소(/@notice)를 다른 회원이 쓰고 있어요.");
      const [blog] = await tx`insert into blogs (owner_id, slug, title, intro) values (${user.id}, ${NOTICE.slug}, ${NOTICE.title}, ${NOTICE.intro}) returning id`;
      await tx`insert into categories (blog_id, name, position) values (${blog.id}, ${NOTICE.category}, 1)`;
      console.log("공지 블로그 /@notice 를 만들었어요.");
    });
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e instanceof AdminError ? e.message : e);
  process.exit(1);
});
