import { expect, test, type Page } from "./fixtures";
import { insertPosts, signUpOk, sql, writePost } from "./helpers";

// 주인 도구 막대·글 관리 (BLOG-08, specs/006-post-manager)
test.describe.configure({ timeout: 60_000 });

const rows = (page: Page) => page.getByRole("region", { name: /글 \d+개$/ }).getByRole("listitem");

test.describe("BLOG-08 글 관리", () => {
  test("도구 막대: 주인에게만, 글 관리 N은 비공개 포함", async ({ page, browser }) => {
    const owner = await signUpOk(page);
    await writePost(page, "공개", "본문");
    await writePost(page, "비밀", "본문", { private: true });
    await page.goto(`/@${owner}`);
    const tools = page.getByRole("navigation", { name: "주인 도구" });
    await expect(tools.getByRole("link")).toHaveText(["✏️ 새 글 쓰기", "📝 글 관리 2", "💬 댓글 관리", "🗂 카테고리 관리", "🎨 꾸미기", "⚙️ 블로그 설정"]);
    await tools.getByRole("link", { name: "🗂 카테고리 관리" }).click();
    await expect(page).toHaveURL("/settings/blog#categories");
    await expect(page.locator("#categories")).toBeInViewport();

    const other = await browser.newPage();
    await signUpOk(other);
    await other.goto(`/@${owner}`);
    await expect(other.getByRole("navigation", { name: "주인 도구" })).toHaveCount(0);
    const visitor = await browser.newPage();
    await visitor.goto("/settings/posts");
    await expect(visitor).toHaveURL("/");
  });

  test("상태·카테고리·검색으로 거르고, 페이지를 넘겨도 조건 유지", async ({ page }) => {
    const owner = await signUpOk(page);
    await insertPosts(owner, 21);
    await insertPosts(owner, 2, false);
    await page.goto("/settings/blog");
    await page.getByLabel("새 카테고리 이름").fill("여행");
    await page.locator("#categories").getByRole("button", { name: "추가", exact: true }).click();
    await expect(page.locator("#categories")).toContainText("여행");
    await writePost(page, "제주 100% 후기", "바다", { category: "여행", private: true });

    await page.goto("/settings/posts");
    await expect(page.getByLabel("글 수", { exact: true })).toHaveText("전체 24 · 공개 21 · 비공개 3");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("내 글 24개");
    await expect(rows(page)).toHaveCount(20);
    await expect(rows(page).first()).toContainText("제주 100% 후기");
    await expect(rows(page).first()).toContainText("🔒 비공개 · 여행");

    await page.getByLabel("상태").selectOption("private");
    await page.getByRole("button", { name: "거르기" }).click();
    await expect(page).toHaveURL(/visibility=private/);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("찾은 글 3개");

    await page.getByLabel("상태").selectOption("");
    await page.getByLabel("카테고리").selectOption({ label: "여행" });
    await page.getByRole("button", { name: "거르기" }).click();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("찾은 글 1개");

    await page.goto("/settings/posts?s=" + encodeURIComponent("100%"));
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("찾은 글 1개");
    await page.goto("/settings/posts?s=" + encodeURIComponent("본문") + "&visibility=public");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("찾은 글 21개");
    await page.getByRole("navigation", { name: "페이지" }).getByRole("link", { name: "2" }).click();
    await expect(page).toHaveURL(/visibility=public/);
    await expect(rows(page)).toHaveCount(1);
    await page.getByRole("link", { name: "조건 지우기" }).click();
    await expect(page).toHaveURL("/settings/posts");

    await page.goto("/settings/posts?s=%20");
    await expect(page.getByRole("alert").filter({ hasText: "찾을 말을 적어 주세요" })).toBeVisible();
    // 이상한 값은 무시
    await page.goto("/settings/posts?visibility=x&cat=c0&page=abc");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("내 글 24개");
  });

  test("공개·비공개 바꾸기와 삭제는 내 글에만, 수정 시각은 그대로", async ({ page, browser }) => {
    const owner = await signUpOk(page);
    const id = await writePost(page, "바꿀 글", "본문");
    const gone = await writePost(page, "지울 글", "본문");
    const [{ updated_at: before }] = await sql`select updated_at from posts where id = ${id}`;
    await page.goto("/settings/posts");

    await page.getByRole("button", { name: "바꿀 글 비공개로" }).click();
    await expect(page.getByLabel("글 수", { exact: true })).toHaveText("전체 2 · 공개 1 · 비공개 1");
    await expect(page.getByRole("button", { name: "바꿀 글 공개로" })).toBeVisible();
    const visitor = await browser.newPage();
    expect((await visitor.goto(`/@${owner}/${id}`))!.status()).toBe(404);
    const [{ updated_at: after, is_public }] = await sql`select updated_at, is_public from posts where id = ${id}`;
    expect(is_public).toBe(false);
    expect(after).toEqual(before);

    const messages: string[] = [];
    page.once("dialog", (d) => {
      messages.push(d.message());
      void d.dismiss();
    });
    await page.getByRole("button", { name: "지울 글 삭제" }).click();
    await expect.poll(() => messages).toEqual(["이 글을 삭제할까요? 댓글과 공감도 함께 지워져요."]);
    await expect(page.getByLabel("글 수", { exact: true })).toHaveText("전체 2 · 공개 1 · 비공개 1");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "지울 글 삭제" }).click();
    await expect(page.getByLabel("글 수", { exact: true })).toHaveText("전체 1 · 공개 0 · 비공개 1");
    await expect(page).toHaveURL("/settings/posts");
    expect(await sql`select 1 from posts where id = ${gone}`).toHaveLength(0);

    await page.getByRole("link", { name: "바꿀 글 수정" }).click();
    await expect(page).toHaveURL(`/write/${id}`);

    // 남의 글 ID로 바꿔 보내면 아무것도 바뀌지 않는다
    const other = await browser.newPage();
    await signUpOk(other);
    await writePost(other, "내 글", "본문");
    await other.goto("/settings/posts");
    await other.route("**/*", async (route) => {
      const req = route.request();
      if (req.method() === "POST" && req.headers()["next-action"]) {
        return route.continue({ postData: req.postData()!.replace(/(name="(?:_?\d+_)?postId"\r\n\r\n)\d+/, `$1${id}`) });
      }
      return route.continue();
    });
    other.once("dialog", (d) => d.accept());
    const res = other.waitForResponse((r) => r.request().method() === "POST");
    await other.getByRole("button", { name: "내 글 삭제" }).click();
    await res;
    await sql`update posts set is_public = true where id = ${id}`;
    const res2 = other.waitForResponse((r) => r.request().method() === "POST");
    await other.getByRole("button", { name: "내 글 비공개로" }).click();
    await res2;
    expect((await sql`select is_public from posts where id = ${id}`)[0].is_public).toBe(true);
    // 남의 글은 그대로, 요청을 바꿨으니 내 글도 그대로
    expect(await sql`select 1 from posts where id = ${id}`).toHaveLength(1);
    await other.unroute("**/*");
  });

  test("375px에서 가로 스크롤 없음", async ({ page }) => {
    await signUpOk(page);
    await writePost(page, "아주 긴 제목 ".repeat(8), "본문");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/settings/posts");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});
