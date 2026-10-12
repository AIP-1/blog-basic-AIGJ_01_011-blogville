import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { PDF, dispatchFiles, png, uploadDirect } from "./files";
import { signUpOk, sql } from "./helpers";

// 프로필 사진 (BLOG-03 올리기·지우기, BLOG-04 블로그 홈 표시, POST-07 첨부 규칙), specs/030-profile-photo
test.describe.configure({ timeout: 90_000 });

const keyOf = (url: string) => url.split("/").pop()!;
const photoKey = async (username: string) =>
  (await sql`select p.photo_key from profiles p join users u on u.id = p.user_id where u.username = ${username}`)[0].photo_key as string | null;
const choose = (page: Page) => page.getByLabel("📷 사진 고르기");
// 페이지에는 Next의 경로 안내(role=alert)도 있어 프로필 사진 칸 안에서만 찾는다
const photoBox = (page: Page) => page.getByRole("region", { name: "프로필 사진" });
const cleanup = () => execFileSync("npm", ["run", "-s", "posts:cleanup"], { encoding: "utf8" });

test.describe("BLOG-03·04 프로필 사진", () => {
  test("올리면 블로그 홈 이름 옆 48px 사진, 방문자도 볼 수 있고, 바꾸면 전 사진은 떨어지고, 지우면 첫 글자 원과 404", async ({ page, browser }) => {
    const username = await signUpOk(page);
    // 처음에는 닉네임 첫 글자 원
    await expect(page.locator("header [data-avatar-fallback]").first()).toHaveText(username[0]);

    await page.goto("/settings/account");
    await expect(page.getByRole("heading", { name: "프로필 사진" })).toBeVisible();
    // 사진이 아닌 파일은 올리지 않는다
    await choose(page).setInputFiles({ name: "문서.pdf", mimeType: "application/pdf", buffer: PDF });
    await expect(photoBox(page).getByRole("alert")).toHaveText("사진 파일이 아니에요. PNG·JPG·GIF·WEBP 사진만 올릴 수 있어요");
    expect(await photoKey(username)).toBeNull();

    await choose(page).setInputFiles(png("나.png", 8, 8));
    await expect(photoBox(page).getByRole("status")).toHaveText("프로필 사진을 바꿨어요");
    const first = (await photoKey(username))!;
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    await expect(page.getByRole("img", { name: `${username} 프로필 사진` })).toHaveAttribute("src", `/files/${first}`);

    await page.goto(`/@${username}`);
    const avatar = page.getByRole("img", { name: `${username} 프로필 사진` });
    await expect(avatar).toHaveAttribute("src", `/files/${first}`);
    const box = (await avatar.boundingBox())!;
    expect(Math.round(box.width)).toBe(48);
    expect(Math.round(box.height)).toBe(48);
    await expect(page.locator("header [data-avatar-fallback]")).toHaveCount(0);

    // 로그인하지 않은 방문자도 프로필 사진은 본다 (붙지 않은 다른 첨부는 못 본다)
    const visitor = await browser.newPage();
    expect((await visitor.request.get(`/files/${first}`)).status()).toBe(200);
    await visitor.goto(`/@${username}`);
    await expect(visitor.getByRole("img", { name: `${username} 프로필 사진` })).toBeVisible();
    const loose = await uploadDirect(page, png("붙지 않은.png"));
    expect((await visitor.request.get(`/files/${loose.json.key}`)).status()).toBe(404);

    // 하루 넘게 지난 프로필 사진도 정리 작업이 지우지 않는다
    await sql`update attachments set created_at = now() - interval '2 days' where key = ${first}`;
    cleanup();
    expect(await sql`select 1 from attachments where key = ${first}`).toHaveLength(1);

    // 바꾸면 전 사진은 떨어진 첨부가 되고 방문자는 더 못 본다
    await page.goto("/settings/account");
    await choose(page).setInputFiles(png("새 나.png", 6, 6));
    await expect(photoBox(page).getByRole("status")).toHaveText("프로필 사진을 바꿨어요");
    const second = (await photoKey(username))!;
    expect(second).not.toBe(first);
    const [old] = await sql`select detached_at from attachments where key = ${first}`;
    expect(old.detached_at).not.toBeNull();
    expect((await visitor.request.get(`/files/${first}`)).status()).toBe(404);
    // 떨어진 지 하루가 지나면 정리 작업이 지운다
    await sql`update attachments set detached_at = now() - interval '2 days' where key = ${first}`;
    cleanup();
    expect(await sql`select 1 from attachments where key = ${first}`).toHaveLength(0);

    // 지우기: 확인 창에서 취소하면 그대로, 확인하면 첫 글자 원으로
    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("button", { name: "사진 지우기" }).click();
    await page.waitForTimeout(300);
    expect(await photoKey(username)).toBe(second);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "사진 지우기" }).click();
    await expect(photoBox(page).getByRole("status")).toHaveText("프로필 사진을 지웠어요");
    expect(await photoKey(username)).toBeNull();
    await expect(page.getByRole("button", { name: "사진 지우기" })).toHaveCount(0);
    expect((await visitor.request.get(`/files/${second}`)).status()).toBe(404);
    await page.goto(`/@${username}`);
    await expect(page.locator("header [data-avatar-fallback]").first()).toBeVisible();
    await expect(page.getByRole("img", { name: `${username} 프로필 사진` })).toHaveCount(0);
  });

  test("내 프로필 사진을 글에 붙여 넣으면 새로 올라가 글에 붙고 프로필 사진은 그대로, 남의 첨부 키로는 프로필 사진을 바꿀 수 없고, 탈퇴하면 함께 지워진다", async ({ page, browser }) => {
    const username = await signUpOk(page);
    await page.goto("/settings/account");
    await choose(page).setInputFiles(png("프로필.png"));
    await expect(photoBox(page).getByRole("status")).toHaveText("프로필 사진을 바꿨어요");
    const key = (await photoKey(username))!;

    await page.goto("/write");
    await page.getByLabel("제목", { exact: true }).fill("프로필 사진 붙여 넣기");
    await page.getByLabel("본문").click();
    await dispatchFiles(page, "paste", [], `<p>사진</p><img src="/files/${key}">`);
    const img = page.locator(".tiptap img");
    await expect(img).toHaveAttribute("src", /^\/files\/[0-9a-f]{32}$/);
    const pasted = keyOf((await img.getAttribute("src"))!);
    expect(pasted).not.toBe(key);
    await page.getByRole("button", { name: "발행하기" }).click();
    await expect(page).toHaveURL(/\/@[a-z0-9_]+\/\d+$/);
    const postId = Number(page.url().split("/").pop());
    const rows = await sql`select key, post_id from attachments where key in (${key}, ${pasted})`;
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.post_id]));
    expect(byKey[pasted]).toBe(postId);
    expect(byKey[key]).toBeNull();
    expect(await photoKey(username)).toBe(key);
    await sql`update posts set created_at = '2001-01-01' where id = ${postId}`;

    // 남이 올린 사진의 키를 받은 것처럼 꾸며도 저장되지 않는다
    const other = await browser.newPage();
    await signUpOk(other);
    await other.goto("/write");
    const theirs = await uploadDirect(other, png("남의 것.png"));
    await page.goto("/settings/account");
    await page.route("**/api/uploads", (route) => route.fulfill({ status: 201, json: { key: theirs.json.key } }));
    await choose(page).setInputFiles(png("가짜.png"));
    await expect(photoBox(page).getByRole("alert")).toHaveText("이 사진은 프로필 사진으로 쓸 수 없어요. 다시 올려 주세요.");
    expect(await photoKey(username)).toBe(key);
    // 글에 붙은 내 첨부도 안 된다
    await page.unroute("**/api/uploads");
    await page.route("**/api/uploads", (route) => route.fulfill({ status: 201, json: { key: pasted } }));
    await choose(page).setInputFiles(png("가짜2.png"));
    await expect(photoBox(page).getByRole("alert")).toHaveText("이 사진은 프로필 사진으로 쓸 수 없어요. 다시 올려 주세요.");
    expect(await photoKey(username)).toBe(key);

    // 오래전에 올린 내 첨부도 안 된다 (정리 작업과 겹치지 않게 막 올린 것만 받는다)
    await page.goto("/write");
    const stale = await uploadDirect(page, png("오래된.png"));
    await sql`update attachments set created_at = now() - interval '2 hours' where key = ${stale.json.key}`;
    await page.goto("/settings/account");
    await page.unroute("**/api/uploads");
    await page.route("**/api/uploads", (route) => route.fulfill({ status: 201, json: { key: stale.json.key } }));
    await choose(page).setInputFiles(png("가짜3.png"));
    await expect(photoBox(page).getByRole("alert")).toHaveText("이 사진은 프로필 사진으로 쓸 수 없어요. 다시 올려 주세요.");
    expect(await photoKey(username)).toBe(key);

    // 탈퇴(회원 행 삭제)하면 프로필과 사진 첨부가 함께 지워진다
    await sql`delete from users where username = ${username}`;
    expect(await sql`select 1 from attachments where key = ${key}`).toHaveLength(0);
  });
});
