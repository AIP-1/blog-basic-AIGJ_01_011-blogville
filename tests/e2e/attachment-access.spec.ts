import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page } from "./fixtures";
import { dispatchFiles, png, uploadDirect } from "./files";
import { signUpOk, sql } from "./helpers";

// 회원 둘·업로드·글 수정을 한 시험에서 하므로, 전체 실행(4개 동시)에서 30초를 넘길 때가 있다
test.describe.configure({ timeout: 60_000 });

const IMAGE_INPUT = /^사진 올리기/;

async function member(browser: Browser) {
  const page = await browser.newPage();
  const username = await signUpOk(page);
  return { page, username };
}

/** 사진 하나가 든 글을 발행하고 [글ID, 사진 주소] */
async function postWithImage(page: Page, opts: { private?: boolean } = {}) {
  await page.goto("/write");
  await page.getByLabel("제목", { exact: true }).fill("사진 글");
  await page.getByLabel("본문").click();
  await page.keyboard.type("본문");
  await page.getByLabel(IMAGE_INPUT).setInputFiles([png()]);
  await expect(page.locator(".tiptap img")).toHaveCount(1);
  const url = (await page.locator(".tiptap img").getAttribute("src"))!;
  if (opts.private) await page.getByText("🔒 비공개").click();
  await page.getByRole("button", { name: "발행하기" }).click();
  await expect(page).toHaveURL(/\/@[a-z0-9_]+\/\d+$/);
  return [Number(page.url().split("/").pop()), url] as const;
}

const status = async (page: Page, url: string, headers: Record<string, string> = {}) =>
  (await page.request.get(url, { headers })).status();

test.describe("US3 누가 여나", () => {
  test("붙지 않은 첨부는 올린 사람만, 공개 글은 누구나, 비공개 글은 주인만", async ({ browser }) => {
    const a = await member(browser);
    const b = await member(browser);
    const visitor = await browser.newPage();

    const up = await uploadDirect(a.page, png());
    expect(await status(a.page, up.json.url)).toBe(200);
    expect(await status(b.page, up.json.url)).toBe(404);
    expect(await status(visitor, up.json.url)).toBe(404);
    expect(await visitor.request.get(up.json.url).then((r) => r.text())).toBe("파일을 찾을 수 없어요");

    const [id, url] = await postWithImage(a.page);
    const res = await visitor.request.get(url);
    expect(res.status()).toBe(200);
    expect(res.headers()).toMatchObject({
      "content-type": "image/png",
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-cache",
      etag: `"${url.split("/").pop()}"`,
      "content-disposition": "inline",
    });
    expect(res.headers()["content-security-policy"]).toContain("sandbox");
    const etag = res.headers().etag;
    expect(await status(visitor, url, { "if-none-match": etag })).toBe(304);

    // 비공개로 바꾸면 주인만
    await a.page.goto(`/write/${id}`);
    await a.page.getByText("🔒 비공개").click();
    await a.page.getByRole("button", { name: "수정 완료" }).click();
    await expect(a.page).toHaveURL(`/@${a.username}/${id}`);
    expect(await status(visitor, url)).toBe(404);
    expect(await status(visitor, url, { "if-none-match": etag })).toBe(404);
    expect(await status(b.page, url)).toBe(404);
    expect(await status(a.page, url)).toBe(200);

    expect(await status(visitor, "/files/not-a-key")).toBe(404);
    expect(await status(visitor, `/files/${"0".repeat(32)}`)).toBe(404);
  });

  test("남의 첨부·다른 글에 붙은 첨부·없는 키를 섞어 보내면 저장할 때 빠진다", async ({ browser }) => {
    const a = await member(browser);
    const b = await member(browser);
    const [otherId, otherUrl] = await postWithImage(a.page);
    const bUpload = await uploadDirect(b.page, png());
    const mine = await uploadDirect(a.page, png());

    await a.page.goto("/write");
    await a.page.getByLabel("제목", { exact: true }).fill("섞은 글");
    await a.page.getByLabel("본문").click();
    await a.page.keyboard.type("본문");
    await dispatchFiles(a.page, "paste", [], `<p>붙여 넣기</p><img src="${mine.json.url}">`);
    await expect(a.page.locator(".tiptap img")).toHaveCount(1);
    // 붙여 넣기는 남의 것·다른 글 것을 넣지 않으므로(POST-07 흐름 7), 저장 요청을 직접 고쳐 섞어 보낸다
    const extra = [otherUrl, bUpload.json.url, `/files/${"0".repeat(32)}`].map((u) => `<img src="${u}" alt="">`).join("");
    let tampered = false;
    await a.page.route("**/write", async (route) => {
      const body = route.request().postData() ?? "";
      const img = new RegExp(`<img src="${mine.json.url}"[^>]*>`);
      if (route.request().method() !== "POST" || !img.test(body)) return route.continue();
      tampered = true;
      await route.continue({ postData: body.replace(img, (m) => m + extra) });
    });
    await a.page.getByRole("button", { name: "발행하기" }).click();
    await expect(a.page).toHaveURL(/\/\d+$/);
    expect(tampered).toBe(true);
    const id = Number(a.page.url().split("/").pop());

    const [post] = await sql`select content_html from posts where id = ${id}`;
    const keys = [...post.content_html.matchAll(/\/files\/([0-9a-f]{32})/g)].map((m) => m[1]);
    expect(keys).toEqual([mine.json.key]);
    const rows = await sql`select key, post_id from attachments where key in ${sql([otherUrl.split("/").pop()!, bUpload.json.key, mine.json.key])}`;
    const postOf = Object.fromEntries(rows.map((r) => [r.key, r.post_id]));
    expect(postOf[otherUrl.split("/").pop()!]).toBe(otherId);
    expect(postOf[bUpload.json.key]).toBeNull();
    expect(postOf[mine.json.key]).toBe(id);
  });

  test("본문에서 빼거나 글을 지우면 떨어지고 방문자는 못 연다", async ({ browser }) => {
    const a = await member(browser);
    const visitor = await browser.newPage();
    const [id, url] = await postWithImage(a.page);
    const key = url.split("/").pop()!;

    await a.page.goto(`/write/${id}`);
    await a.page.locator(".tiptap img").click();
    await a.page.keyboard.press("Backspace");
    await expect(a.page.locator(".tiptap img")).toHaveCount(0);
    await a.page.getByRole("button", { name: "수정 완료" }).click();
    await expect(a.page).toHaveURL(`/@${a.username}/${id}`);
    let [row] = await sql`select post_id, detached_at from attachments where key = ${key}`;
    expect(row.post_id).toBeNull();
    expect(row.detached_at).not.toBeNull();
    expect(await status(visitor, url)).toBe(404);
    expect(await status(a.page, url)).toBe(200);

    const [id2, url2] = await postWithImage(a.page);
    {
      await a.page.goto(`/@${a.username}/${id2}`);
      a.page.once("dialog", (d) => d.accept());
      await a.page.getByRole("button", { name: "삭제" }).click();
      await expect(a.page).toHaveURL(`/@${a.username}`);
    }
    [row] = await sql`select post_id, detached_at from attachments where key = ${url2.split("/").pop()!}`;
    expect(row.post_id).toBeNull();
    expect(row.detached_at).not.toBeNull();
  });
});

test.describe("US4 정리 작업", () => {
  test("하루 지난 붙지 않은 첨부만 지우고 --dry-run은 세기만", async ({ browser }) => {
    const a = await member(browser);
    const old = await uploadDirect(a.page, png());
    const fresh = await uploadDirect(a.page, png());
    const [, linkedUrl] = await postWithImage(a.page);
    const linked = linkedUrl.split("/").pop()!;
    // 오래된 것처럼 만든다 (붙어 있는 첨부도 오래됐지만 남아야 한다)
    await sql`update attachments set created_at = now() - interval '2 days' where key in ${sql([old.json.key, linked])}`;

    const run = (...args: string[]) => execFileSync("npm", ["run", "-s", "posts:cleanup", "--", ...args], { encoding: "utf8" });
    const dry = run("--dry-run");
    expect(dry).toMatch(/지울 첨부: [1-9]\d*개/);
    expect(await sql`select 1 from attachments where key = ${old.json.key}`).toHaveLength(1);

    expect(run()).toMatch(/지운 첨부: [1-9]\d*개/);
    const left = (await sql`select key from attachments where key in ${sql([old.json.key, fresh.json.key, linked])}`).map((r) => r.key);
    expect(left.sort()).toEqual([fresh.json.key, linked].sort());
    const dir = path.resolve(process.env.UPLOAD_DIR ?? "storage/uploads");
    expect(existsSync(path.join(dir, old.json.key))).toBe(false);
    expect(existsSync(path.join(dir, fresh.json.key))).toBe(true);
  });
});
