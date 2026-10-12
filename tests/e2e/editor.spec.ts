import { expect, test, type Page } from "@playwright/test";
import { signUpOk, sql } from "./helpers";

// 에디터 도구 모음 (POST-01 에디터 도구, NF-18 초점), specs/019-editor-toolbar
test.describe.configure({ timeout: 60_000 });

const toolbar = (page: Page) => page.getByRole("toolbar", { name: "글 꾸미기" });
const tool = (page: Page, name: string) => toolbar(page).getByRole("button", { name, exact: true });
const body = (page: Page) => page.getByLabel("본문");

async function openWrite(page: Page) {
  await signUpOk(page);
  await page.goto("/write");
  await expect(body(page)).toBeVisible();
}

test.describe("POST-01 에디터 도구", () => {
  test("명세 순서·구분, 마우스를 올리면 이름, 고른 도구는 검은 바탕, 모두 44px", async ({ page }) => {
    await openWrite(page);
    await expect(toolbar(page).getByRole("button")).toHaveText(["H2", "H3", "B", "I", "U", "S", "•", "1.", "❝", "</>", "―", "🔗", "↶", "↷", "🖼 사진", "📎 파일"]);
    const names = await toolbar(page)
      .getByRole("button")
      .evaluateAll((els) => els.slice(0, 14).map((el) => el.getAttribute("title")));
    expect(names).toEqual(["큰 제목", "작은 제목", "굵게", "기울임", "밑줄", "취소선", "글머리 목록", "번호 목록", "인용", "코드 블록", "구분선", "링크", "되돌리기", "다시 실행"]);
    await expect(toolbar(page).getByRole("separator")).toHaveCount(4);
    for (const box of await toolbar(page).getByRole("button").all()) {
      const b = (await box.boundingBox())!;
      expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
    }

    await body(page).click();
    await page.keyboard.type("굵은 글");
    await page.keyboard.press("ControlOrMeta+a");
    await tool(page, "굵게").click();
    await expect(tool(page, "굵게")).toHaveAttribute("aria-pressed", "true");
    await expect(tool(page, "굵게")).toHaveCSS("background-color", "rgb(35, 32, 27)");
    await expect(tool(page, "기울임")).toHaveAttribute("aria-pressed", "false");
  });

  test("U·S로 꾸민 글자는 발행한 글에 밑줄·취소선으로 남고, [삭제] 확인 창은 명세 문구·자바스크립트 없이 지워지지 않음", async ({ page, browser }) => {
    await openWrite(page);
    await page.getByLabel("제목", { exact: true }).fill("밑줄 취소선");
    await body(page).click();
    await page.keyboard.type("밑줄");
    await page.keyboard.press("Enter");
    await page.keyboard.type("취소");
    await page.keyboard.press("ControlOrMeta+Home");
    await page.keyboard.press("Shift+End");
    await tool(page, "밑줄").click();
    await expect(tool(page, "밑줄")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("Shift+Home");
    await tool(page, "취소선").click();
    await expect(tool(page, "취소선")).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "발행하기" }).click();
    await expect(page).toHaveURL(/\/@[a-z0-9_]+\/\d+$/);
    const article = page.locator(".prose-post");
    await expect(article.locator("u")).toHaveText("밑줄");
    await expect(article.locator("s")).toHaveText("취소");

    // 글 상세 [삭제] 확인 창 문구 (POST-01 삭제)
    const messages: string[] = [];
    page.once("dialog", (d) => {
      messages.push(d.message());
      void d.dismiss();
    });
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await expect.poll(() => messages).toEqual(["이 글을 삭제할까요? 댓글과 공감도 함께 지워져요."]);
    await expect(article.locator("u")).toHaveText("밑줄");

    // 자바스크립트가 없으면(화면이 준비되기 전과 같다) 확인 창 없이 지워지지 않는다
    const postId = Number(page.url().split("/").pop());
    const noJs = await (await browser.newContext({ javaScriptEnabled: false, storageState: await page.context().storageState() })).newPage();
    await noJs.goto(page.url());
    await noJs.getByRole("button", { name: "삭제", exact: true }).click();
    await noJs.waitForLoadState("load");
    expect(await sql`select id from posts where id = ${postId}`).toHaveLength(1);
  });

  test("↶ 되돌리기·↷ 다시 실행: 처음엔 눌리지 않고, 친 글자를 되돌렸다가 다시 살린다", async ({ page }) => {
    await openWrite(page);
    await expect(tool(page, "되돌리기")).toBeDisabled();
    await expect(tool(page, "다시 실행")).toBeDisabled();
    await body(page).click();
    await page.keyboard.type("되돌릴 글자");
    await expect(body(page)).toHaveText("되돌릴 글자");
    await expect(tool(page, "되돌리기")).toBeEnabled();
    await tool(page, "되돌리기").click();
    await expect(body(page)).not.toContainText("되돌릴 글자");
    await expect(tool(page, "다시 실행")).toBeEnabled();
    await tool(page, "다시 실행").click();
    await expect(body(page)).toHaveText("되돌릴 글자");
  });

  test("🔗 링크 창: 문구와 기본값 https://, https://만 두면 링크가 생기지 않고, 링크 위에서 비우면 풀린다", async ({ page }) => {
    await openWrite(page);
    await body(page).click();
    await page.keyboard.type("블로그빌");
    await page.keyboard.press("Shift+Home");

    const seen: { message: string; value: string }[] = [];
    let answer = "https://";
    page.on("dialog", (d) => {
      seen.push({ message: d.message(), value: d.defaultValue() });
      void d.accept(answer);
    });
    await tool(page, "링크").click();
    await expect.poll(() => seen.length).toBe(1);
    expect(seen[0]).toEqual({ message: "링크 주소 (비우면 링크 해제)", value: "https://" });
    await expect(body(page).locator("a")).toHaveCount(0);

    answer = "https://example.com/blog";
    await body(page).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Shift+Home");
    await tool(page, "링크").click();
    await expect(body(page).locator("a")).toHaveAttribute("href", "https://example.com/blog");
    await expect(tool(page, "링크")).toHaveAttribute("aria-pressed", "true");

    // 링크 안에 커서만 두고 다시 누르면 지금 주소가 기본값, 비우면 링크 전체가 풀린다
    answer = "";
    await body(page).locator("a").click();
    await page.keyboard.press("ArrowLeft");
    await tool(page, "링크").click();
    await expect.poll(() => seen.length).toBe(3);
    expect(seen[2].value).toBe("https://example.com/blog");
    await expect(body(page).locator("a")).toHaveCount(0);
    await expect(body(page)).toHaveText("블로그빌");
  });

  test("본문 칸에 초점이 가면 감싼 상자에 초점선이 보이고, 375px에서 도구 모음이 감겨 가로 스크롤이 없다", async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: { width: 375, height: 800 } })).newPage();
    await openWrite(page);
    const root = page.locator("[data-editor-root]");
    await expect(root).toHaveCSS("outline-style", "none");
    await tool(page, "링크").focus(); // ↶·↷는 아직 눌리지 않아 건너뛴다
    await page.keyboard.press("Tab"); // 🖼 사진
    await page.keyboard.press("Tab"); // 📎 파일
    await page.keyboard.press("Tab"); // 본문
    await expect(body(page)).toBeFocused();
    await expect(root).toHaveCSS("outline-style", "solid");
    await expect(root).toHaveCSS("outline-width", "3px");
    const bar = (await toolbar(page).boundingBox())!;
    expect(bar.height).toBeGreaterThan(44 * 2); // 여러 줄
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});
