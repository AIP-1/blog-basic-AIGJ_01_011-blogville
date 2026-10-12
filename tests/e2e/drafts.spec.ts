import { expect, test, type Page } from "./fixtures";
import { PASSWORD, signIn, signUpOk, sql, writePost } from "./helpers";

// 임시 저장 (POST-08, specs/009-drafts)
test.describe.configure({ timeout: 60_000 });

const status = (page: Page) => page.locator("[data-draft-status]");
const stored = (page: Page) =>
  page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("blogville:draft:")).map((k) => [k, localStorage.getItem(k)]));

async function typeDraft(page: Page, title: string, body: string) {
  await page.goto("/write");
  await page.getByLabel("제목", { exact: true }).fill(title);
  await page.getByLabel("본문").click();
  await page.keyboard.type(body);
}

test.describe("POST-08 임시 저장", () => {
  test("2초 뒤 저장되고, 다시 열면 물어서 서식·공개 설정·태그까지 채운다", async ({ page }) => {
    const me = await signUpOk(page);
    await page.goto("/write");
    await expect(status(page)).toHaveText("작성 중인 글은 이 브라우저에 자동 저장됩니다.");
    await page.getByLabel("제목", { exact: true }).fill("쓰던 글");
    await page.getByLabel("본문").click();
    await page.keyboard.press("Control+b");
    await page.keyboard.type("굵은 본문");
    await page.getByLabel("태그").fill("git, 회고");
    await page.getByText("🔒 비공개").click();
    await expect(status(page)).toHaveText(/^임시 저장됨 \d{2}:\d{2}$/, { timeout: 5000 });
    const keys = await stored(page);
    expect(keys).toHaveLength(1);
    const [{ id }] = await sql`select id from users where username = ${me}`;
    expect(keys[0][0]).toBe(`blogville:draft:${id}`);

    const asked: string[] = [];
    page.once("dialog", (d) => {
      asked.push(d.message());
      d.accept();
    });
    await page.goto("/write");
    await expect(page.getByLabel("제목", { exact: true })).toHaveValue("쓰던 글");
    expect(asked).toEqual(["작성 중이던 글이 있어요. 불러올까요?"]);
    await expect(page.locator(".tiptap strong")).toHaveText("굵은 본문");
    await expect(page.getByLabel("태그")).toHaveValue("git, 회고");
    await expect(page.getByRole("radio", { name: "🔒 비공개" })).toBeChecked();
    // 불러온 값만으로는 다시 저장하지 않는다
    await expect(status(page)).toHaveText("작성 중인 글은 이 브라우저에 자동 저장됩니다.");
  });

  test("[취소]하면 빈 화면, 임시 글은 남는다. 태그만 쓰면 저장하지 않는다", async ({ page }) => {
    await signUpOk(page);
    await typeDraft(page, "남길 글", "본문");
    await expect(status(page)).toHaveText(/임시 저장됨/, { timeout: 5000 });
    page.once("dialog", (d) => d.dismiss());
    await page.goto("/write");
    await expect(page.getByLabel("제목", { exact: true })).toHaveValue("");
    expect(await stored(page)).toHaveLength(1);
    await page.getByLabel("태그").fill("태그만");
    await page.waitForTimeout(2500);
    await expect(status(page)).toHaveText("작성 중인 글은 이 브라우저에 자동 저장됩니다.");
    expect((await stored(page))[0][1]).toContain("남길 글");
  });

  test("발행 실패면 남고, 2초 안에 발행해 성공하면 지워져 다시 묻지 않는다", async ({ page }) => {
    await signUpOk(page);
    await page.goto("/write");
    await page.getByLabel("제목", { exact: true }).fill("본문 없는 글");
    await expect(status(page)).toHaveText(/임시 저장됨/, { timeout: 5000 });
    await page.getByRole("button", { name: "발행하기" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    expect(await stored(page)).toHaveLength(1);

    await page.getByLabel("본문").click();
    await page.keyboard.type("바로 발행");
    await page.getByRole("button", { name: "발행하기" }).click();
    await expect(page).toHaveURL(/\/@[a-z0-9_]+\/\d+$/);
    await page.waitForTimeout(2500);
    expect(await stored(page)).toHaveLength(0);
    let asked = false;
    page.on("dialog", (d) => {
      asked = true;
      d.dismiss();
    });
    await page.goto("/write");
    await expect(page.getByLabel("제목", { exact: true })).toHaveValue("");
    expect(asked).toBe(false);
  });

  test("수정 화면에는 임시 저장이 없다, 로그아웃하면 지워진다, 다른 회원에게는 묻지 않는다", async ({ page }) => {
    const a = await signUpOk(page);
    const id = await writePost(page, "고칠 글", "본문");
    await page.goto(`/write/${id}`);
    await page.getByLabel("제목", { exact: true }).fill("고친 제목");
    await page.waitForTimeout(2500);
    await expect(status(page)).toHaveCount(0);
    expect(await stored(page)).toHaveLength(0);

    await typeDraft(page, "A의 글", "본문");
    await expect(status(page)).toHaveText(/임시 저장됨/, { timeout: 5000 });
    // 로그아웃하지 않고 쿠키만 지워 다른 회원으로 가입: A의 임시 글은 묻지 않는다
    await page.context().clearCookies();
    await signUpOk(page);
    let asked = false;
    page.on("dialog", (d) => {
      asked = true;
      d.dismiss();
    });
    await page.goto("/write");
    await expect(page.getByLabel("제목", { exact: true })).toBeVisible();
    expect(asked).toBe(false);
    expect(await stored(page)).toHaveLength(1);

    // A로 다시 로그인해 로그아웃하면 A의 임시 글이 지워진다
    await page.context().clearCookies();
    await signIn(page, a, PASSWORD);
    await expect(page).toHaveURL("/town");
    // 마을에는 헤더 막대가 없어 블로그에서 로그아웃한다
    await page.goto(`/@${a}`);
    // 화면이 다 준비된 뒤 누른다 (준비 전이면 브라우저가 폼을 바로 보내 지우는 코드가 돌지 않는다)
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(page.getByRole("button", { name: "로그아웃" })).toHaveCount(0);
    expect(await stored(page)).toHaveLength(0);
  });

  test("브라우저 저장소가 막혀도 글쓰기·발행이 된다", async ({ page }) => {
    await page.addInitScript(() => {
      const fail = () => {
        throw new DOMException("blocked", "SecurityError");
      };
      Object.defineProperty(window, "localStorage", { get: fail, configurable: true });
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await signUpOk(page);
    await typeDraft(page, "저장소 없음", "본문");
    await page.waitForTimeout(2500);
    await expect(status(page)).toHaveText("작성 중인 글은 이 브라우저에 자동 저장됩니다.");
    await page.getByRole("button", { name: "발행하기" }).click();
    await expect(page).toHaveURL(/\/@[a-z0-9_]+\/\d+$/);
    await expect(page.getByRole("heading", { name: "저장소 없음" })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
