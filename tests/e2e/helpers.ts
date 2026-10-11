import { expect, type Page } from "@playwright/test";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

/** 테스트끼리 겹치지 않는 아이디 (4~20자) */
export function uid(prefix = "t"): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20);
}

export const sql = postgres(process.env.DATABASE_URL!, { max: 2 });

export const PASSWORD = "password1";

export async function signUp(page: Page, username: string, opts: { password?: string; blogTitle?: string } = {}) {
  await page.goto("/");
  await page.getByRole("tab", { name: "회원가입" }).click();
  await page.getByLabel("아이디").fill(username);
  await page.getByLabel("비밀번호", { exact: true }).fill(opts.password ?? PASSWORD);
  await page.getByLabel("비밀번호 확인").fill(opts.password ?? PASSWORD);
  if (opts.blogTitle !== undefined) await page.getByLabel("블로그 이름").fill(opts.blogTitle);
  await page.getByRole("button", { name: "회원가입" }).click();
}

export async function signUpOk(page: Page, username = uid()) {
  await signUp(page, username);
  await expect(page).toHaveURL(new RegExp(`/@${username.toLowerCase()}\\?welcome=1$`));
  return username.toLowerCase();
}

export async function signIn(page: Page, username: string, password = PASSWORD, remember = false) {
  await page.goto("/");
  await page.getByLabel("아이디").fill(username);
  await page.getByLabel("비밀번호").fill(password);
  if (remember) await page.getByLabel("로그인 상태 유지").check();
  await page.getByRole("button", { name: "로그인" }).click();
}

/** 글쓰기 화면에서 글을 발행하고 글 ID를 돌려준다 */
export async function writePost(page: Page, title: string, body: string, opts: { private?: boolean; category?: string; sub?: string } = {}) {
  await page.goto("/write");
  await page.getByLabel("제목", { exact: true }).fill(title);
  if (opts.category) await page.getByLabel("대분류").selectOption({ label: opts.category });
  if (opts.sub) await page.getByLabel("소분류").selectOption({ label: opts.sub });
  await page.getByLabel("본문").click();
  await page.keyboard.type(body);
  if (opts.private) await page.getByText("🔒 비공개").click();
  await page.getByRole("button", { name: "발행하기" }).click();
  await expect(page).toHaveURL(/\/@[a-z0-9_]+\/\d+$/);
  return Number(page.url().split("/").pop());
}

/** 화면을 거치지 않고 글을 여러 개 넣는다 (목록 시험용) */
export async function insertPosts(username: string, count: number, isPublic = true) {
  const [blog] = await sql`select b.id from blogs b join users u on u.id = b.owner_id where u.username = ${username}`;
  for (let i = 1; i <= count; i++) {
    await sql`insert into posts (blog_id, title, content_html, content_text, is_public, created_at)
      values (${blog.id}, ${"글 " + i}, ${"<p>본문 " + i + "</p>"}, ${"본문 " + i}, ${isPublic}, now() - make_interval(mins => ${count - i}))`;
  }
}
