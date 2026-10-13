import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import { expect, test, type Page } from "./fixtures";
import { png } from "./files";
import { signUpOk, sql, uid, writePost } from "./helpers";

// 내 블로그 내보내기 (.zip 백업): 블로그 관리 → 📦 내보내기

const BUTTON = "내 블로그 내려받기 (.zip)";

async function downloadZip(page: Page) {
  await page.goto("/settings/blog");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: BUTTON }).click();
  const file = await download;
  const files = unzipSync(new Uint8Array(await readFile((await file.path())!)));
  return { name: file.suggestedFilename(), files, text: (path: string) => strFromU8(files[path]) };
}

test("주인이 내려받으면 README·blog.json·글 HTML·MD·사진·댓글·방명록이 들어 있고, 곧바로 다시 누르면 기다리라고 한다", async ({ page, browser }) => {
  const owner = await signUpOk(page, uid("ex"));

  // 사진을 넣은 공개 글
  await page.goto("/write");
  await page.getByLabel("제목", { exact: true }).fill("공개 내보내기 글");
  await page.getByLabel("본문").click();
  await page.keyboard.type("공개 본문입니다");
  await page.getByLabel(/^사진 올리기/).setInputFiles([png("가을.png")]);
  await expect(page.locator(".tiptap img")).toHaveCount(1);
  await page.getByRole("button", { name: "발행하기" }).click();
  await expect(page).toHaveURL(/\/@[a-z0-9_]+\/\d+$/);
  const publicId = Number(page.url().split("/").pop());

  const privateId = await writePost(page, "비밀 내보내기 글", "나만 보는 본문", { private: true });
  const [blog] = await sql`select b.id, b.owner_id from blogs b where b.slug = ${owner}`;
  const [scheduled] = await sql`insert into posts (blog_id, title, content_html, content_text, is_public, publish_at)
    values (${blog.id}, '예약 내보내기 글', '<p>예약 본문</p>', '예약 본문', false, now() + interval '3 days') returning id`;

  // 다른 회원의 비밀 댓글·비밀 방명록 (주인은 볼 수 있어 들어간다. 아이디는 빠진다)
  const otherCtx = await browser.newContext();
  const guest = await signUpOk(await otherCtx.newPage(), uid("eg"));
  await otherCtx.close();
  const [g] = await sql`select u.id, p.nickname from users u join profiles p on p.user_id = u.id where u.username = ${guest}`;
  await sql`insert into comments (post_id, author_id, content, is_secret) values (${publicId}, ${g.id}, '비밀 댓글 내용', true)`;
  await sql`insert into guestbook_entries (blog_id, author_id, content, is_secret) values (${blog.id}, ${g.id}, '비밀 방명록 내용', true)`;

  const zip = await downloadZip(page);
  expect(zip.name).toMatch(new RegExp(`^blogville-${owner}-\\d{8}\\.zip$`));
  const names = Object.keys(zip.files);
  expect(names).toEqual(expect.arrayContaining(["README.txt", "index.html", "blog.json", "comments.json", "guestbook.json"]));
  expect(zip.text("README.txt")).toContain("blog.json");

  const info = JSON.parse(zip.text("blog.json"));
  expect(info.blog.slug).toBe(owner);
  const titles = info.posts.map((p: { title: string }) => p.title);
  expect(titles).toEqual(expect.arrayContaining(["공개 내보내기 글", "비밀 내보내기 글", "예약 내보내기 글"]));

  for (const [id, title] of [
    [publicId, "공개 내보내기 글"],
    [privateId, "비밀 내보내기 글"],
    [scheduled.id, "예약 내보내기 글"],
  ] as const) {
    const base = names.find((n) => n.startsWith(`posts/${id}-`) && n.endsWith(".html"))!.replace(/\.html$/, "");
    expect(zip.text(`${base}.html`)).toContain(title);
    expect(zip.text(`${base}.md`)).toContain(`title: "${title}"`);
  }
  const privateHtml = zip.text(names.find((n) => n.startsWith(`posts/${privateId}-`) && n.endsWith(".html"))!);
  expect(privateHtml).toContain("나만 보는 본문");
  expect(privateHtml).toContain("비공개");
  expect(zip.text(names.find((n) => n.startsWith(`posts/${scheduled.id}-`) && n.endsWith(".md"))!)).toContain("예약 발행");

  // 사진은 files/ 에, 글은 상대 경로로 가리킨다
  const image = names.find((n) => /^files\/[0-9a-f]{32}\.png$/.test(n))!;
  expect(image).toBeTruthy();
  expect([...zip.files[image].slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  const publicHtml = zip.text(names.find((n) => n.startsWith(`posts/${publicId}-`) && n.endsWith(".html"))!);
  expect(publicHtml).toContain(`src="../${image}"`);
  expect(publicHtml).not.toContain('src="/files/');

  const comments = zip.text("comments.json");
  expect(comments).toContain("비밀 댓글 내용");
  expect(comments).toContain(g.nickname);
  const guestbook = zip.text("guestbook.json");
  expect(guestbook).toContain("비밀 방명록 내용");
  for (const text of [comments, guestbook, zip.text("blog.json")]) {
    expect(text).not.toContain(g.id);
    expect(text).not.toContain(blog.owner_id);
  }

  // 10분 안에 다시 누르면 내려받지 않고 안내
  await page.getByRole("link", { name: BUTTON }).click();
  await expect(page).toHaveURL(/\/settings\/blog\?export=wait/);
  await expect(page.locator("#export").getByRole("alert")).toContainText("10분에 한 번");
});

test("방문자와 다른 회원은 남의 블로그를 내려받을 수 없다 (404)", async ({ page, browser }) => {
  const ownerCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  const owner = await signUpOk(ownerPage, uid("eo"));
  await writePost(ownerPage, "주인만의 비밀 글", "비밀", { private: true });
  await ownerCtx.close();

  // 방문자 (로그인 안 함)
  const visitor = await browser.newContext();
  expect((await visitor.request.get("/settings/export", { maxRedirects: 0 })).status()).toBe(404);
  expect((await visitor.request.get(`/settings/export?blog=${owner}`, { maxRedirects: 0 })).status()).toBe(404);
  await visitor.close();

  // 다른 회원: 남의 주소는 404, 주소 없이 받으면 자기 블로그뿐
  const other = await signUpOk(page, uid("ex"));
  expect((await page.request.get(`/settings/export?blog=${owner}`, { maxRedirects: 0 })).status()).toBe(404);
  const res = await page.request.get("/settings/export", { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/zip");
  const files = unzipSync(new Uint8Array(await res.body()));
  expect(JSON.parse(strFromU8(files["blog.json"])).blog.slug).toBe(other);
  expect(Object.values(files).some((f) => strFromU8(f).includes("주인만의 비밀 글"))).toBe(false);
});
