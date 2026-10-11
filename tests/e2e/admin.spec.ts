import { expect, test, type Page } from "@playwright/test";
import { signUpOk, sql, writePost } from "./helpers";

// 관리자 (AUTH-08, specs/012-admin)
test.describe.configure({ timeout: 60_000 });

async function makeAdmin(page: Page) {
  const username = await signUpOk(page);
  await sql`update users set role = 'admin' where username = ${username}`;
  return username;
}

test.describe("AUTH-08 관리자", () => {
  test("방문자·일반 회원은 /admin이 404이고 👑가 없으며, 삭제 요청을 조작해도 글이 그대로다", async ({ page, browser }) => {
    const visitor = await browser.newPage();
    expect((await visitor.goto("/admin"))!.status()).toBe(404);

    const owner = await signUpOk(page);
    const postId = await writePost(page, "지키는 글", "본문");
    expect((await page.goto("/admin"))!.status()).toBe(404);
    await page.goto(`/@${owner}`);
    await expect(page.getByRole("link", { name: "관리자" })).toHaveCount(0);

    // 관리자가 누른 삭제 요청을 가로채(보내지 않고) 일반 회원 쿠키로 다시 보낸다
    await sql`update posts set created_at = now() + interval '1 hour' where id = ${postId}`;
    const admin = await browser.newPage();
    await makeAdmin(admin);
    await admin.goto("/admin");
    let captured: { url: string; headers: Record<string, string>; body: string } | null = null;
    await admin.route("**/admin", async (route) => {
      const req = route.request();
      if (req.method() === "POST" && req.headers()["next-action"]) {
        captured = { url: req.url(), headers: req.headers(), body: req.postData()! };
        return route.abort();
      }
      return route.continue();
    });
    admin.once("dialog", (d) => d.accept());
    await admin.locator(`[data-post="${postId}"]`).getByRole("button", { name: "지키는 글 삭제" }).click();
    await expect.poll(() => captured !== null).toBe(true);
    const { url, headers: sentHeaders, body } = captured!;
    // 가로챈 요청은 서버에 가지 않았다
    expect(await sql`select 1 from posts where id = ${postId}`).toHaveLength(1);
    // 가로챈 헤더에는 관리자 쿠키가 들어 있으므로 빼고, 일반 회원 쿠키로 보낸다
    const headers = Object.fromEntries(Object.entries(sentHeaders).filter(([k]) => k !== "cookie"));
    await page.request.post(url, { headers, data: body });
    expect(await sql`select 1 from posts where id = ${postId}`).toHaveLength(1);
    // 같은 요청을 관리자 쿠키로 보내면 지워진다 (요청 모양이 맞다는 확인)
    await admin.request.post(url, { headers, data: body });
    expect(await sql`select 1 from posts where id = ${postId}`).toHaveLength(0);
  });

  test("통계 카드 4개, 최근 가입(아이디 표시), 최근 글에서 확인 창을 거쳐 남의 글을 지운다, 비공개 글은 링크 없음", async ({ page, browser }) => {
    const other = await browser.newPage();
    const o = await signUpOk(other);
    const pub = await writePost(other, "남의 공개 글", "본문");
    const secret = await writePost(other, "남의 비밀 글", "본문", { private: true });
    // 다른 시험이 동시에 쓴 글보다 앞에 오도록 (최근 글은 30개까지만 보인다). 마을 소식 시험(하루 뒤)보다는 뒤다.
    await sql`update posts set created_at = now() + interval '1 hour' where id in ${sql([pub, secret])}`;

    const me = await makeAdmin(page);
    await page.goto(`/@${me}`);
    await page.getByRole("link", { name: "관리자" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "👑 관리자" })).toBeVisible();
    await expect(page.locator("[data-stat]")).toHaveCount(4);
    for (const label of ["가입 계정", "전체 글", "댓글", "오늘 새 글"]) await expect(page.locator(`[data-stat="${label}"]`)).toHaveText(/^[\d,]+$/);
    expect(await page.locator("[data-member]").count()).toBeLessThanOrEqual(20);
    await expect(page.locator(`[data-member="${me}"]`)).toContainText("(아이디)");
    await expect(page.locator(`[data-member="${me}"]`)).toContainText("👑 관리자");
    await expect(page.locator(`[data-member="${o}"]`)).toContainText("회원");

    const secretRow = page.locator(`[data-post="${secret}"]`);
    await expect(secretRow).toContainText("🔒");
    await expect(secretRow.getByRole("link")).toHaveCount(0);
    await expect(page.locator(`[data-post="${pub}"]`).getByRole("link", { name: "남의 공개 글" })).toHaveAttribute("href", `/@${o}/${pub}`);

    let message = "";
    page.once("dialog", (d) => {
      message = d.message();
      d.dismiss();
    });
    await page.getByRole("button", { name: "남의 공개 글 삭제" }).click();
    expect(message).toBe("'남의 공개 글' 글을 삭제할까요?");
    expect(await sql`select 1 from posts where id = ${pub}`).toHaveLength(1);

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "남의 공개 글 삭제" }).click();
    await expect(page.locator(`[data-post="${pub}"]`)).toHaveCount(0);
    expect(await sql`select 1 from posts where id = ${pub}`).toHaveLength(0);
    await sql`delete from posts where id = ${secret}`;
  });

  test("관리자는 남의 댓글을 지울 수 있다, 375px에서 가로 스크롤 없음·삭제 44px", async ({ browser }) => {
    const o = await browser.newPage();
    const owner = await signUpOk(o);
    const postId = await writePost(o, "댓글 글", "본문");
    await sql`update posts set created_at = now() + interval '1 hour' where id = ${postId}`;
    await sql`insert into comments (post_id, author_id, content) select ${postId}, u.id, '지울 댓글' from users u where u.username = ${owner}`;

    const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
    await makeAdmin(page);
    await page.goto(`/@${owner}/${postId}`);
    page.once("dialog", (d) => d.accept());
    await page.locator("#comments").getByRole("article").filter({ hasText: "지울 댓글" }).getByRole("button", { name: /삭제/ }).click();
    await expect(page.locator("#comments").getByText("삭제된 댓글이에요")).toBeVisible();

    await page.goto("/admin");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const del = page.locator(`[data-post="${postId}"]`).getByRole("button", { name: "댓글 글 삭제" });
    const box = (await del.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeLessThan(60);
  });
});
