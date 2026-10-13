import { expect, test } from "./fixtures";
import { png, uploadDirect } from "./files";
import { signUpOk, sql } from "./helpers";

// 글 읽기 편의: 읽는 시간·목차·코드 색칠·[복사]·사진 크게 보기·공유·맨 위로

/** 화면을 거치지 않고 본문 HTML을 정해 글을 넣는다 (정화된 모양 그대로). 글 ID를 돌려준다. */
async function insertPost(username: string, title: string, html: string, text: string, isPublic = true): Promise<number> {
  const [blog] = await sql`select b.id from blogs b join users u on u.id = b.owner_id where u.username = ${username}`;
  const [row] = await sql`insert into posts (blog_id, title, content_html, content_text, is_public)
    values (${blog.id}, ${title}, ${html}, ${text}, ${isPublic}) returning id`;
  return row.id as number;
}

const LONG = "가".repeat(1500);
const CODE = "const answer = 42;\nfunction add(a, b) {\n  return a + b;\n}";

test.describe("글 읽기 편의", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("읽는 시간, 소제목 3개 이상이면 목차 → 누르면 그 소제목으로", async ({ page }) => {
    const me = await signUpOk(page);
    const filler = `<p>${"내용을 길게 적어요. ".repeat(80)}</p>`;
    const html = `<h2>시작하며</h2>${filler}<h3>설치 방법</h3>${filler}<h2>마치며</h2>${filler}`;
    const id = await insertPost(me, "목차 글", html, LONG);
    await page.goto(`/@${me}/${id}`);
    await expect(page.getByText("약 3분 읽기")).toBeVisible();

    const toc = page.getByRole("navigation", { name: "목차" });
    await expect(page.locator("details[data-toc]")).toHaveAttribute("open", "");
    await expect(page.locator("details[data-toc] summary")).toHaveText("📑 목차");
    await expect(toc.getByRole("link")).toHaveText(["시작하며", "설치 방법", "마치며"]);
    await expect(page.locator(".prose-post h3")).toHaveAttribute("id", "설치-방법");

    await toc.getByRole("link", { name: "마치며" }).click();
    await expect(page).toHaveURL(new RegExp(`#${encodeURIComponent("마치며")}$`));
    await expect(page.locator(".prose-post h2#마치며")).toBeInViewport();
  });

  test("소제목이 2개뿐이면 목차가 없고, 짧은 글은 약 1분", async ({ page }) => {
    const me = await signUpOk(page);
    const id = await insertPost(me, "짧은 글", "<h2>하나</h2><p>a</p><h2>둘</h2><p>b</p>", "a b");
    await page.goto(`/@${me}/${id}`);
    await expect(page.getByText("약 1분 읽기")).toBeVisible();
    await expect(page.locator(".prose-post h2").first()).toHaveAttribute("id", "하나");
    await expect(page.locator("[data-toc]")).toHaveCount(0);
  });

  test("코드 블록은 색칠되고 [복사]로 코드가 복사된다", async ({ page }) => {
    const me = await signUpOk(page);
    const escaped = CODE.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const id = await insertPost(me, "코드 글", `<p>예시</p><pre><code>${escaped}</code></pre>`, `예시\n${CODE}`);
    await page.goto(`/@${me}/${id}`);
    const block = page.locator(".code-block");
    await expect(block.locator("pre code.hljs")).toHaveText(CODE);
    await expect(block.locator(".hljs-keyword").first()).toHaveText("const");
    // 밝은 바탕
    expect(await block.locator("pre").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(246, 243, 236)");

    const copy = block.getByRole("button", { name: "복사" });
    await copy.click();
    await expect(copy).toHaveText("복사했어요");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CODE);
    await expect(copy).toHaveText("복사", { timeout: 5000 });
  });

  test("사진을 누르면 크게 보이고 Esc·[닫기]·바깥으로 닫힌다, 키보드로도 연다", async ({ page }) => {
    const me = await signUpOk(page);
    const up = await uploadDirect(page, png("큰사진.png", 40, 30));
    expect(up.status).toBe(201);
    const id = await insertPost(me, "사진 글", `<p>사진</p><p><img src="${up.json.url}" alt="" /></p>`, "사진");
    await page.goto(`/@${me}/${id}`);
    const img = page.locator(".prose-post img");
    const box = page.locator("dialog[data-lightbox]");
    await expect(img).toHaveAttribute("role", "button");
    await expect(box).toBeHidden();

    await img.click();
    await expect(box).toBeVisible();
    await expect(box.locator("img")).toHaveAttribute("src", up.json.url);
    await page.keyboard.press("Escape");
    await expect(box).toBeHidden();

    await img.click();
    await box.getByRole("button", { name: "닫기" }).click();
    await expect(box).toBeHidden();

    await img.click();
    await expect(box).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(box).toBeHidden();

    await img.focus();
    await page.keyboard.press("Enter");
    await expect(box).toBeVisible();
    await expect(box.getByRole("button", { name: "닫기" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(box).toBeHidden();
  });

  test("공유 막대: [링크 복사]는 알림을 띄우고, 비공개 글에는 공유 막대가 없다", async ({ page }) => {
    const me = await signUpOk(page);
    const id = await insertPost(me, "공유할 글", "<p>같이 봐요</p>", "같이 봐요");
    await page.goto(`/@${me}/${id}`);
    const bar = page.locator("[data-share-bar]");
    await bar.getByRole("button", { name: "🔗 링크 복사" }).click();
    await expect(page.getByRole("status").filter({ hasText: "링크를 복사했어요" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(new RegExp(`^https?://[^/]+/@${me}/${id}$`));
    const x = bar.getByRole("link", { name: "X에 공유" });
    await expect(x).toHaveAttribute("href", /^https:\/\/x\.com\/intent\/post\?/);
    await expect(x).toHaveAttribute("rel", /noopener/);
    await expect(bar.getByRole("link", { name: "페이스북에 공유" })).toHaveAttribute("href", /^https:\/\/www\.facebook\.com\/sharer\/sharer\.php\?u=/);

    const hidden = await insertPost(me, "숨은 글", "<p>나만</p>", "나만", false);
    await page.goto(`/@${me}/${hidden}`);
    await expect(page.getByRole("heading", { name: "숨은 글" })).toBeVisible();
    await expect(page.locator("[data-share-bar]")).toHaveCount(0);
  });

  test("긴 글을 내려 읽으면 [맨 위로]가 뜨고 누르면 맨 위로", async ({ page }) => {
    const me = await signUpOk(page);
    const id = await insertPost(me, "아주 긴 글", `<p>${"길게 이어지는 문장입니다. ".repeat(40)}</p>`.repeat(30), LONG);
    await page.goto(`/@${me}/${id}`);
    const top = page.getByRole("button", { name: "맨 위로" });
    await expect(top).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(top).toBeVisible();
    const box = (await top.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await top.click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(top).toHaveCount(0);
  });

  test("375px 화면에서 가로로 넘치지 않는다 (긴 코드 줄·목차·공유 막대)", async ({ page }) => {
    const me = await signUpOk(page);
    const longLine = `const veryLongVariableName = ${"'abcdefghij' + ".repeat(20)}'end';`;
    const html = `<h2>하나</h2><p>a</p><h2>둘</h2><pre><code>${longLine}</code></pre><h3>셋</h3><p>c</p>`;
    const id = await insertPost(me, "좁은 화면", html, `a ${longLine} c`);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/@${me}/${id}`);
    await expect(page.locator(".code-block")).toBeVisible();
    // 좁은 화면에서는 목차가 접혀 있다
    await expect(page.locator("details[data-toc]")).not.toHaveAttribute("open", "");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});
