import { expect, test, type Page } from "@playwright/test";
import { signUpOk, sql } from "./helpers";

// 오류 화면 `잠깐 문제가 생겼어요`의 [다시 시도]와 루트 오류 화면 (NF-19, 화면 목록), specs/020-error-retry
test.describe.configure({ timeout: 60_000 });

/** 개발 서버는 레이아웃 오류 위에 Next 개발 도구 창을 띄운다. 운영에는 없는 창이라 닫고 진행한다 */
async function closeDevOverlay(page: Page) {
  const overlay = page.getByRole("dialog", { name: "Runtime Error" });
  if (await overlay.waitFor({ state: "visible", timeout: 5_000 }).then(() => true, () => false)) {
    await page.keyboard.press("Escape");
    await expect(overlay).toBeHidden();
  }
}

test.describe("NF-19 오류 화면", () => {
  test("글 화면이 실패하면 헤더는 그대로 오류 화면, 원인이 사라진 뒤 [다시 시도]를 누르면 서버에서 다시 받아 글이 보인다", async ({ page }) => {
    const username = await signUpOk(page);
    // 날짜를 읽을 수 없는 글은 글 상세를 그리다 실패한다. 비공개라 다른 시험의 목록에는 나오지 않는다
    const [{ id }] = await sql`insert into posts (blog_id, title, content_html, content_text, is_public, created_at, updated_at)
      select b.id, '다시 시도 글', '<p>본문</p>', '본문', false, '-infinity', '-infinity'
      from blogs b join users u on u.id = b.owner_id where u.username = ${username} returning posts.id`;
    try {
      await page.goto(`/@${username}/${id}`);
      await expect(page.getByRole("heading", { name: "잠깐 문제가 생겼어요" })).toBeVisible();
      await expect(page).toHaveTitle("잠깐 문제가 생겼어요 | Blogville");
      await expect(page.getByRole("navigation", { name: "메뉴" }).getByRole("link", { name: "내 블로그" })).toBeVisible();
      const retry = page.getByRole("button", { name: "다시 시도" });
      expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);

      await sql`update posts set created_at = '2001-01-01', updated_at = '2001-01-01' where id = ${id}`;
      await retry.click();
      await expect(page.getByRole("heading", { level: 1, name: "다시 시도 글" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "잠깐 문제가 생겼어요" })).toHaveCount(0);
      await expect(page).toHaveURL(new RegExp(`/@${username}/${id}$`));
    } finally {
      await sql`delete from posts where id = ${id}`;
    }
  });

  test("헤더(레이아웃)까지 실패해도 영어 기본 화면이 아니라 한국어 오류 화면, [다시 시도]로 돌아오고 [처음으로]는 첫 화면", async ({ page }) => {
    const username = await signUpOk(page);
    const [blog] = await sql`select b.owner_id, b.slug, b.title from blogs b join users u on u.id = b.owner_id where u.username = ${username}`;
    // 블로그가 없는 회원은 헤더의 [내 블로그]를 그리다 실패한다
    await sql`delete from blogs where owner_id = ${blog.owner_id}`;
    try {
      await page.goto("/settings/account");
      await expect(page.getByRole("heading", { name: "잠깐 문제가 생겼어요" })).toBeVisible();
      await closeDevOverlay(page);
      await expect(page).toHaveTitle("잠깐 문제가 생겼어요 | Blogville");
      await expect(page.locator("html")).toHaveAttribute("lang", "ko");
      await expect(page.getByRole("navigation", { name: "메뉴" })).toHaveCount(0);
      const retry = page.getByRole("button", { name: "다시 시도" });
      // Blogville 단추 모양 그대로 (globals.css를 불러온다)
      expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expect(retry).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(page.getByRole("link", { name: "처음으로" })).toHaveAttribute("href", "/");

      await sql`insert into blogs (owner_id, slug, title) values (${blog.owner_id}, ${blog.slug}, ${blog.title})`;
      await retry.click();
      await expect(page.getByRole("navigation", { name: "메뉴" }).getByRole("link", { name: "내 블로그" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "잠깐 문제가 생겼어요" })).toHaveCount(0);
      await expect(page).toHaveURL(/\/settings\/account$/);
    } finally {
      await sql`insert into blogs (owner_id, slug, title) values (${blog.owner_id}, ${blog.slug}, ${blog.title}) on conflict do nothing`;
    }
  });

  test("[처음으로]는 레이아웃부터 새로 불러온다", async ({ page }) => {
    const username = await signUpOk(page);
    const [blog] = await sql`select b.owner_id, b.slug, b.title from blogs b join users u on u.id = b.owner_id where u.username = ${username}`;
    await sql`delete from blogs where owner_id = ${blog.owner_id}`;
    try {
      await page.goto("/feed");
      await expect(page.getByRole("heading", { name: "잠깐 문제가 생겼어요" })).toBeVisible();
      await closeDevOverlay(page);
      await sql`insert into blogs (owner_id, slug, title) values (${blog.owner_id}, ${blog.slug}, ${blog.title})`;
      await page.getByRole("link", { name: "처음으로" }).click();
      // 로그인한 회원의 첫 화면은 내 블로그
      await expect(page).toHaveURL(new RegExp(`/@${username}$`));
      await expect(page.getByRole("navigation", { name: "메뉴" })).toBeVisible();
    } finally {
      await sql`insert into blogs (owner_id, slug, title) values (${blog.owner_id}, ${blog.slug}, ${blog.title}) on conflict do nothing`;
    }
  });
});
