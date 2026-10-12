/** 개발용 시드: 회원 demo / demo1234, 카테고리 2개, 글 20개(비공개 2개). 이미 있으면 건너뛴다. */
import { config } from "dotenv";
import { hashPassword } from "better-auth/crypto";
import postgres from "postgres";

config({ path: ".env.local" });
const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  const [exists] = await sql`select id from users where username = 'demo'`;
  if (exists) {
    console.log("demo 회원이 이미 있어요.");
    return;
  }
  const userId = crypto.randomUUID().replace(/-/g, "");
  const password = await hashPassword("demo1234");
  await sql.begin(async (tx) => {
    await tx`insert into users (id, username, display_username, email, name) values (${userId}, 'demo', 'demo', 'demo@users.blogville.invalid', 'demo')`;
    await tx`insert into accounts (id, user_id, account_id, provider_id, password) values (${crypto.randomUUID().replace(/-/g, "")}, ${userId}, ${userId}, 'credential', ${password})`;
    await tx`insert into user_items (user_id, item_id) select ${userId}, id from items where code = 'char_girl'`;
    await tx`insert into profiles (user_id, nickname, character_item_id) values (${userId}, '데모', (select id from items where code = 'char_girl'))`;
    await tx`insert into user_items (user_id, item_id) select ${userId}, id from items where code = 'bg_meadow'`;
    const [blog] = await tx`insert into blogs (owner_id, slug, title, intro, background_item_id) values (${userId}, 'demo', '데모 블로그', 'Blogville 시드 데이터', (select id from items where code = 'bg_meadow')) returning id`;
    const [daily] = await tx`insert into categories (blog_id, name, position) values (${blog.id}, '일상', 1) returning id`;
    const [travel] = await tx`insert into categories (blog_id, name, position) values (${blog.id}, '여행', 2) returning id`;
    const [food] = await tx`insert into subcategories (category_id, name, position) values (${travel.id}, '맛집', 1) returning id`;
    for (let i = 1; i <= 20; i++) {
      const [cat, sub] = i % 3 === 0 ? [travel.id, food.id] : i % 3 === 1 ? [daily.id, null] : [null, null];
      await tx`insert into posts (blog_id, category_id, subcategory_id, title, content_html, content_text, is_public, created_at)
        values (${blog.id}, ${cat}, ${sub}, ${`데모 글 ${i}`}, ${`<p>데모 본문 ${i}</p>`}, ${`데모 본문 ${i}`}, ${i > 2}, now() - make_interval(hours => ${20 - i}))`;
    }
  });
  console.log("demo / demo1234 회원과 글 20개를 만들었어요. /@demo");
}

main().finally(() => sql.end());
