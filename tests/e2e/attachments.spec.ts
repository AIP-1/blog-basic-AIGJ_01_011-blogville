import { request as pwRequest } from "node:http";
import { expect, test, type Page } from "./fixtures";
import { dispatchFiles, makePng, PDF, png, uploadDirect } from "./files";
import { signUpOk, sql } from "./helpers";

const IMAGE_INPUT = /^사진 올리기/;
const FILE_INPUT = /^파일 올리기/;

async function startPost(page: Page, title = "첨부 글") {
  await page.goto("/write");
  await page.getByLabel("제목", { exact: true }).fill(title);
  await page.getByLabel("본문").click();
  await page.keyboard.type("사진과 파일");
}

async function publish(page: Page) {
  await page.getByRole("button", { name: "발행하기" }).click();
  await expect(page).toHaveURL(/\/@[a-z0-9_]+\/\d+$/);
  return Number(page.url().split("/").pop());
}

const editorImages = (page: Page) => page.locator(".tiptap img");

test.describe("US1 사진 넣기", () => {
  test("두 장을 골라 발행하면 상세·수정 화면에 보이고, 본문에는 /files/ 주소만", async ({ page }) => {
    await signUpOk(page);
    await startPost(page);
    await page.getByLabel(IMAGE_INPUT).setInputFiles([png("하나.png"), png("둘.png")]);
    await expect(editorImages(page)).toHaveCount(2);
    const id = await publish(page);

    const imgs = page.locator(".prose-post img");
    await expect(imgs).toHaveCount(2);
    for (const img of await imgs.all()) expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);

    const [post] = await sql`select content_html, content_text from posts where id = ${id}`;
    expect(post.content_html).toMatch(/<img src="\/files\/[0-9a-f]{32}" alt="" \/>.*<img src="\/files\/[0-9a-f]{32}" alt="" \/>/);
    expect(post.content_html).not.toContain("data:");
    expect(post.content_text).toBe("사진과 파일");

    await page.getByRole("link", { name: "수정" }).click();
    await expect(editorImages(page)).toHaveCount(2);
  });

  test("붙여 넣기·끌어다 놓기로 넣는다", async ({ page }) => {
    await signUpOk(page);
    await startPost(page);
    await dispatchFiles(page, "paste", [png("스크린샷.png")]);
    await expect(editorImages(page)).toHaveCount(1);
    await dispatchFiles(page, "drop", [png("끌기.png")]);
    await expect(editorImages(page)).toHaveCount(2);
  });

  test("올리는 동안 발행 버튼이 막히고 진행이 보인다", async ({ page }) => {
    await signUpOk(page);
    await startPost(page);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route("**/api/uploads", async (route) => {
      await gate;
      await route.continue();
    });
    await page.getByLabel(IMAGE_INPUT).setInputFiles([png("a.png"), png("b.png")]);
    await expect(page.getByRole("status")).toHaveText("올리는 중... (1/2)");
    await expect(page.getByRole("button", { name: "첨부를 올리는 중..." })).toBeDisabled();
    await dispatchFiles(page, "paste", [png("c.png")]);
    await expect(page.getByText("c.png: 다른 파일을 올리는 중이에요. 끝난 뒤 다시 넣어 주세요")).toBeVisible();
    release();
    await expect(editorImages(page)).toHaveCount(2);
    await expect(page.getByRole("button", { name: "발행하기" })).toBeEnabled();
  });

  test("형식·크기 오류는 문구만 남기고 문제없는 사진은 들어간다", async ({ page }) => {
    await signUpOk(page);
    await startPost(page);
    await page.getByLabel(IMAGE_INPUT).setInputFiles([
      { name: "그림.bmp", mimeType: "image/bmp", buffer: Buffer.from("BM....") },
      { name: "가짜.png", mimeType: "image/png", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>') },
      { name: "큰.png", mimeType: "image/png", buffer: Buffer.concat([makePng(), Buffer.alloc(10 * 1024 * 1024)]) },
      { name: "빈.png", mimeType: "image/png", buffer: Buffer.alloc(0) },
      png("좋은.png"),
    ]);
    await expect(editorImages(page)).toHaveCount(1);
    await expect(page.getByText("그림.bmp: 올릴 수 없는 형식이에요.", { exact: false })).toBeVisible();
    await expect(page.getByText("가짜.png: 사진 파일이 아니에요. PNG·JPG·GIF·WEBP 사진만 올릴 수 있어요")).toBeVisible();
    await expect(page.getByText("큰.png: 사진은 10MB까지 올릴 수 있어요")).toBeVisible();
    await expect(page.getByText("빈.png: 빈 파일은 올릴 수 없어요")).toBeVisible();
    await page.getByRole("button", { name: "문구 닫기" }).first().click();
    await expect(page.getByRole("button", { name: "문구 닫기" })).toHaveCount(3);
  });

  test("사진만 있고 글자가 없으면 본문을 적어 주세요", async ({ page }) => {
    await signUpOk(page);
    await page.goto("/write");
    await page.getByLabel("제목", { exact: true }).fill("사진만");
    await page.getByLabel("본문").click();
    await page.getByLabel(IMAGE_INPUT).setInputFiles([png()]);
    await expect(editorImages(page)).toHaveCount(1);
    await page.getByRole("button", { name: "발행하기" }).click();
    await expect(page.locator("p[role=alert]")).toHaveText("본문을 적어 주세요");
  });

  test("직접 보낸 요청: 다른 Origin·Origin 없음 403, 비로그인 401, 크기 없음 411, 가짜 사진 415", async ({ page, browser, baseURL }) => {
    await signUpOk(page);
    expect((await uploadDirect(page, png(), "https://evil.example")).status).toBe(403);
    expect((await uploadDirect(page, png(), null)).status).toBe(403);
    expect((await uploadDirect(page, png(), "null")).status).toBe(403);
    expect((await uploadDirect(page, { name: "x.png", mimeType: "image/png", buffer: Buffer.from("<svg></svg>") })).status).toBe(415);
    expect((await uploadDirect(page, { name: "x.html", mimeType: "text/html", buffer: Buffer.from("<html></html>") })).status).toBe(415);
    const ok = await uploadDirect(page, png());
    expect(ok.status).toBe(201);
    expect(ok.json.url).toMatch(/^\/files\/[0-9a-f]{32}$/);

    const visitor = await browser.newPage();
    await visitor.goto("/");
    expect((await uploadDirect(visitor, png())).status).toBe(401);
    await visitor.close();

    // Content-Length 없이 나눠 보내는 요청
    const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
    const status = await new Promise<number>((resolve, reject) => {
      const url = new URL("/api/uploads", baseURL);
      const req = pwRequest(url, {
        method: "POST",
        headers: { origin: url.origin, cookie, "content-type": "multipart/form-data; boundary=x", "transfer-encoding": "chunked" },
      });
      req.on("response", (res) => resolve(res.statusCode ?? 0));
      req.on("error", reject);
      req.write("--x\r\n");
      req.end("--x--\r\n");
    });
    expect(status).toBe(411);
  });

  test("375px에서 큰 사진이 든 글도 가로 스크롤이 없다", async ({ page }) => {
    await signUpOk(page);
    await startPost(page);
    await page.getByLabel(IMAGE_INPUT).setInputFiles([png("넓은.png", 2000, 20)]);
    await expect(editorImages(page)).toHaveCount(1);
    await publish(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator(".prose-post img")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});

test.describe("US2 파일 카드", () => {
  test("두 파일을 끌어다 놓아 발행하면 카드가 보이고 원래 이름으로 내려받는다", async ({ page }) => {
    await signUpOk(page);
    await startPost(page);
    await dispatchFiles(page, "drop", [
      { name: "보고서 최종본.pdf", mimeType: "application/pdf", buffer: PDF },
      { name: "계획.hwp", mimeType: "application/x-hwp", buffer: Buffer.from("HWP Document File") },
    ]);
    await expect(page.locator(".tiptap a[data-file]")).toHaveCount(2);
    const id = await publish(page);

    const card = page.getByRole("link", { name: /보고서 최종본\.pdf 내려받기 \(\d+B\)/ });
    await expect(card).toBeVisible();
    await expect(page.locator('.prose-post a[data-file][data-ext="hwp"]')).toHaveAttribute("data-name", "계획.hwp");
    const [post] = await sql`select content_text from posts where id = ${id}`;
    expect(post.content_text).toBe("사진과 파일");

    // 이 환경의 Chromium은 한글 이름을 내려받기 이름으로 쓰지 못해("download") 이름은 머리글로 확인한다
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: /계획\.hwp 내려받기/ }).click();
    const file = await download;
    const { readFile } = await import("node:fs/promises");
    expect((await readFile((await file.path())!)).toString()).toBe("HWP Document File");
    const pdf = await page.request.get((await card.getAttribute("href"))!);
    expect(pdf.headers()["content-disposition"]).toContain("filename*=UTF-8''%EB%B3%B4%EA%B3%A0%EC%84%9C%20%EC%B5%9C%EC%A2%85%EB%B3%B8.pdf");
    expect(await pdf.body()).toEqual(PDF);

    await page.goto(`/write/${id}`);
    await expect(page.locator(".tiptap a[data-file]")).toHaveCount(2);
  });

  test("따옴표·괄호가 든 이름도 filename*로 내려준다", async ({ page }) => {
    await signUpOk(page);
    await startPost(page);
    await page.getByLabel(FILE_INPUT).setInputFiles([{ name: `철수's "발표" (최종).pdf`, mimeType: "application/pdf", buffer: PDF }]);
    const card = page.locator(".tiptap a[data-file]");
    await expect(card).toHaveCount(1);
    const res = await page.request.get((await card.getAttribute("href"))!);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    const name = decodeURIComponent(res.headers()["content-disposition"].split("filename*=UTF-8''")[1]);
    expect(name).toBe(await card.getAttribute("data-name"));
    expect(name).toMatch(/^철수's .발표. \(최종\)\.pdf$/);
  });

  test("EXE는 거부, HTML 직접 415, 30MB 초과 413, [📎 파일]로 고른 사진은 사진으로", async ({ page }) => {
    await signUpOk(page);
    await startPost(page);
    await page.getByLabel(FILE_INPUT).setInputFiles([{ name: "설치.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") }, png("사진.png")]);
    await expect(page.getByText("설치.exe: 올릴 수 없는 형식이에요.", { exact: false })).toBeVisible();
    await expect(editorImages(page)).toHaveCount(1);
    expect((await uploadDirect(page, { name: "a.html", mimeType: "text/html", buffer: Buffer.from("<b>") })).status).toBe(415);
    const big = await uploadDirect(page, { name: "큰.zip", mimeType: "application/zip", buffer: Buffer.alloc(30 * 1024 * 1024 + 1, 1) });
    expect(big.status).toBe(413);
    expect(big.json.error).toBe("파일은 30MB까지 올릴 수 있어요");
  });
});

test("올린 뒤 커서가 마지막 첨부 뒤에 있어 이어 쓰고, 다음 첨부도 그 뒤에 들어간다", async ({ page }) => {
  await signUpOk(page);
  await startPost(page);
  await page.getByLabel(IMAGE_INPUT).setInputFiles([png("첫.png")]);
  await expect(editorImages(page)).toHaveCount(1);
  await page.keyboard.type("사진 설명");
  await page.getByLabel(FILE_INPUT).setInputFiles([{ name: "자료.pdf", mimeType: "application/pdf", buffer: PDF }]);
  await expect(page.locator(".tiptap a[data-file]")).toHaveCount(1);
  const order = await page.locator(".tiptap > *").evaluateAll((els) => els.map((el) => el.tagName + (el.textContent ? `:${el.textContent}` : "")));
  expect(order.slice(0, 4)).toEqual(["P:사진과 파일", "IMG", "P:사진 설명", "A"]);
});
