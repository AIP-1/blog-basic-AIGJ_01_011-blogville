import { expect, test } from "./fixtures";
import { signUpOk, writePost } from "./helpers";

test.describe("US2 글쓰기·발행·상세", () => {
  test("발행 → 상세 → 수정 → 삭제", async ({ page }) => {
    const username = await signUpOk(page);
    const id = await writePost(page, "첫 글", "안녕하세요");
    await expect(page.getByRole("heading", { name: "첫 글" })).toBeVisible();
    await expect(page.locator(".prose-post")).toHaveText("안녕하세요");

    await page.getByRole("link", { name: "수정" }).click();
    await expect(page).toHaveURL(`/write/${id}`);
    await page.getByLabel("제목", { exact: true }).fill("고친 글");
    await page.getByRole("button", { name: "수정 완료" }).click();
    await expect(page).toHaveURL(`/@${username}/${id}`);
    await expect(page.getByRole("heading", { name: "고친 글" })).toBeVisible();
    await expect(page.getByText("· 수정됨")).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "삭제" }).click();
    await expect(page).toHaveURL(`/@${username}`);
    await expect(page.getByText("아직 쓴 글이 없어요.")).toBeVisible();
    expect((await page.goto(`/@${username}/${id}`))!.status()).toBe(404);
  });

  test("마크다운처럼 입력하면 제목·목록·인용·코드 블록이 된다", async ({ page }) => {
    await signUpOk(page);
    await page.goto("/write");
    await page.getByLabel("제목", { exact: true }).fill("서식");
    await page.getByLabel("본문").click();
    await page.keyboard.type("## 소제목\n- 목록\n");
    await page.keyboard.press("Enter");
    await page.keyboard.type("> 인용\n");
    await page.keyboard.press("Enter");
    await page.keyboard.type("``` 코드");
    await page.getByRole("button", { name: "발행하기" }).click();
    const body = page.locator(".prose-post");
    await expect(body.locator("h2")).toHaveText("소제목");
    await expect(body.locator("ul li")).toHaveText("목록");
    await expect(body.locator("blockquote")).toContainText("인용");
    await expect(body.locator("pre code")).toHaveText("코드");
  });

  test("빈 제목·빈 본문 문구, 오류 뒤에도 입력이 남는다", async ({ page }) => {
    await signUpOk(page);
    await page.goto("/write");
    await page.getByRole("button", { name: "발행하기" }).click();
    await expect(page.locator("p[role=alert]")).toHaveText("제목을 적어 주세요");
    await page.getByLabel("제목", { exact: true }).fill("제목만");
    await page.getByText("🔒 비공개").click();
    await page.getByRole("button", { name: "발행하기" }).click();
    await expect(page.locator("p[role=alert]")).toHaveText("본문을 적어 주세요");
    await expect(page.getByLabel("제목", { exact: true })).toHaveValue("제목만");
    await expect(page.getByRole("radio", { name: "🔒 비공개" })).toBeChecked();
  });

  test("비공개 글은 주인에게만 보이고, 남에게는 404", async ({ page, browser }) => {
    const username = await signUpOk(page);
    const id = await writePost(page, "비밀 글", "나만 봐요", { private: true });
    await expect(page.getByText("🔒 비공개")).toBeVisible();

    const visitor = await browser.newPage();
    expect((await visitor.goto(`/@${username}/${id}`))!.status()).toBe(404);
    await expect(visitor.getByRole("heading", { name: "길을 잃었어요" })).toBeVisible();
    await visitor.goto(`/@${username}`);
    await expect(visitor.getByText("비밀 글")).toHaveCount(0);
  });

  test("남의 글 수정 화면과 이상한 주소는 404, 비로그인 글쓰기는 첫 화면", async ({ page, browser }) => {
    // 화면을 열두 번 오가서 전체 테스트를 함께 돌릴 때는 기본 30초가 빠듯하다
    test.slow();
    const owner = await signUpOk(page);
    const id = await writePost(page, "주인 글", "본문");

    const other = await browser.newPage();
    await signUpOk(other);
    expect((await other.goto(`/write/${id}`))!.status()).toBe(404);
    for (const bad of ["abc", "0", "012", "1e1", "2147483648"]) {
      expect((await other.goto(`/@${owner}/${bad}`))!.status()).toBe(404);
      expect((await other.goto(`/write/${bad}`))!.status()).toBe(404);
    }
    expect((await other.goto(`/@${owner.toUpperCase()}`))!.status()).toBe(404);

    const visitor = await browser.newPage();
    await visitor.goto("/write");
    await expect(visitor).toHaveURL("/");
  });
});
