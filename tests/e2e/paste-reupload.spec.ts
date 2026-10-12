import { rm } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { dispatchFiles, PDF, png, uploadDirect } from "./files";
import { signUpOk, sql } from "./helpers";

// 내 다른 글의 첨부 붙여 넣기 (POST-07 흐름 7), specs/014-paste-reupload
test.describe.configure({ timeout: 60_000 });

const keyOf = (url: string) => url.split("/").pop()!;
const rowsOf = (keys: string[]) => sql`select key, post_id, name, user_id from attachments where key in ${sql(keys)}`;

async function startPost(page: Page, title = "붙여 넣은 글") {
  await page.goto("/write");
  await page.getByLabel("제목", { exact: true }).fill(title);
  await page.getByLabel("본문").click();
  await page.keyboard.type("본문");
}

async function publish(page: Page, button = "발행하기") {
  await page.getByRole("button", { name: button }).click();
  await expect(page).toHaveURL(/\/@[a-z0-9_]+\/\d+$/);
  return Number(page.url().split("/").pop());
}

/** 사진(이름 name) 하나가 든 글을 발행하고 [글ID, 사진 주소] */
async function postWithImage(page: Page, name = "원본.png") {
  await startPost(page, "원래 글");
  await dispatchFiles(page, "paste", [png(name)]);
  await expect(page.locator(".tiptap img")).toHaveCount(1);
  const url = (await page.locator(".tiptap img").getAttribute("src"))!;
  return [await publish(page), url] as const;
}

test.describe("POST-07 흐름 7 붙여 넣기 다시 올리기", () => {
  test("내 다른 글 사진은 새 키로 다시 올리고, 남의 것·없는 키는 넣지 않는다. 원래 글은 그대로", async ({ page, browser, baseURL }) => {
    await signUpOk(page);
    const [firstId, url] = await postWithImage(page);
    const b = await browser.newPage();
    await signUpOk(b);
    const theirs = await uploadDirect(b, png());

    await startPost(page);
    // 글 화면에서 복사하면 주소가 이 사이트의 전체 주소로 온다
    const html = `<p>가져옴</p><img src="${baseURL}${url}"><img src="${theirs.json.url}"><img src="/files/${"0".repeat(32)}">`;
    await dispatchFiles(page, "paste", [], html);
    await expect(page.locator(".tiptap img")).toHaveCount(1);
    await expect(page.locator(".tiptap")).toContainText("가져옴");
    const pasted = (await page.locator(".tiptap img").getAttribute("src"))!;
    expect(pasted).toMatch(/^\/files\/[0-9a-f]{32}$/);
    expect(pasted).not.toBe(url);
    const id = await publish(page);

    const rows = await rowsOf([keyOf(url), keyOf(pasted), theirs.json.key]);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(byKey[keyOf(url)].post_id).toBe(firstId);
    expect(byKey[keyOf(pasted)].post_id).toBe(id);
    expect(byKey[keyOf(pasted)].name).toBe("원본.png");
    expect(byKey[keyOf(pasted)].user_id).toBe(byKey[keyOf(url)].user_id);
    expect(byKey[theirs.json.key].post_id).toBeNull();
    const [first] = await sql`select content_html from posts where id = ${firstId}`;
    expect(first.content_html).toContain(url);
    // 두 사진은 같은 내용이고, 방문자도 연다
    const visitor = await browser.newPage();
    const [a, c] = await Promise.all([visitor.request.get(url), visitor.request.get(pasted)]);
    expect(a.status()).toBe(200);
    expect(await c.body()).toEqual(await a.body());
  });

  test("수정 화면에서 이 글의 사진을 붙여 넣으면 다시 올리지 않고, 새 글의 붙지 않은 사진도 그대로", async ({ page }) => {
    await signUpOk(page);
    const [id, url] = await postWithImage(page);
    const before = (await sql`select count(*)::int as n from attachments where user_id = (select user_id from attachments where key = ${keyOf(url)})`)[0].n;

    await page.goto(`/write/${id}`);
    await page.getByLabel("본문").click();
    await page.keyboard.press("End");
    await dispatchFiles(page, "paste", [], `<img src="${url}">`);
    await expect(page.locator(".tiptap img")).toHaveCount(2);
    await expect(page.locator(".tiptap img").nth(1)).toHaveAttribute("src", url);
    await publish(page, "수정 완료");

    const loose = await uploadDirect(page, png());
    await startPost(page);
    await dispatchFiles(page, "paste", [], `<img src="${loose.json.url}">`);
    await expect(page.locator(".tiptap img")).toHaveAttribute("src", loose.json.url);
    const after = (await sql`select count(*)::int as n from attachments where user_id = (select user_id from attachments where key = ${keyOf(url)})`)[0].n;
    expect(after).toBe(before + 1); // 붙이지 않은 사진 하나만 늘었다
  });

  test("파일 카드도 다시 올리고 원래 이름으로 내려받는다", async ({ page }) => {
    await signUpOk(page);
    await startPost(page, "파일 글");
    await dispatchFiles(page, "drop", [{ name: "회의록 (최종).pdf", mimeType: "application/pdf", buffer: PDF }]);
    await expect(page.locator(".tiptap a[data-file]")).toHaveCount(1);
    await publish(page);
    const card = page.locator(".prose-post a[data-file]");
    const original = (await card.getAttribute("href"))!;
    const copied = await card.evaluate((el) => el.outerHTML);

    await startPost(page);
    await dispatchFiles(page, "paste", [], copied);
    const pastedCard = page.locator(".tiptap a[data-file]");
    await expect(pastedCard).toHaveCount(1);
    await expect(pastedCard).toHaveAttribute("data-name", "회의록 (최종).pdf");
    const href = (await pastedCard.getAttribute("href"))!;
    expect(href).not.toBe(original);
    await publish(page);
    const res = await page.request.get(href);
    expect(res.headers()["content-disposition"]).toContain("filename*=UTF-8''");
    expect(await res.body()).toEqual(PDF);
  });

  test("서버가 확인하는 동안 붙여 넣는 중·발행 막힘, 다시 올리기가 실패하면 그 사진만 빼고 문구", async ({ page }) => {
    await signUpOk(page);
    const [, url] = await postWithImage(page, "사라진.png");
    const [, url2] = await postWithImage(page, "멀쩡.png");
    // 저장소에서 파일을 지워 복사가 실패하게 한다
    await rm(path.resolve(process.env.UPLOAD_DIR ?? "storage/uploads", keyOf(url)));

    await startPost(page);
    // 확인 요청을 늦춰 진행 표시를 본다
    await page.route("**/write", async (route) => {
      if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 800));
      await route.continue();
    });
    await dispatchFiles(page, "paste", [], `<img src="${url}"><img src="${url2}">`);
    await expect(page.getByRole("status").filter({ hasText: "붙여 넣는 중..." })).toBeVisible();
    await expect(page.getByRole("button", { name: "첨부를 올리는 중..." })).toBeDisabled();
    await expect(page.getByRole("button", { name: "🖼 사진" })).toBeDisabled();
    await expect(page.getByRole("status").filter({ hasText: /올리는 중\.\.\. \(\d\/2\)/ })).toBeVisible();
    await expect(page.getByText("사라진.png: 올리지 못했어요. 다시 시도해 주세요")).toBeVisible();
    await expect(page.locator(".tiptap img")).toHaveCount(1);
    await expect(page.locator(".tiptap img")).not.toHaveAttribute("src", url2);
    await expect(page.getByRole("button", { name: "발행하기" })).toBeEnabled();
  });
});
