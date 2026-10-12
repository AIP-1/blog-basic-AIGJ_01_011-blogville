import { expect, test, type Page } from "@playwright/test";
import { signUpOk, sql, uid, writePost } from "./helpers";

// 관리자 (AUTH-08, specs/012-admin)
test.describe.configure({ timeout: 60_000 });

async function makeAdmin(page: Page) {
  const username = await signUpOk(page);
  await sql`update users set role = 'admin' where username = ${username}`;
  return username;
}

/** 다른 시험의 최신 글 목록·관리자 최근 글에 나오지 않게 아주 옛 날짜의 글을 넣는다 */
async function oldPost(username: string, title: string, isPublic = true) {
  const [{ id }] = await sql`insert into posts (blog_id, title, content_html, content_text, is_public, created_at)
    select b.id, ${title}, '<p>본문</p>', '본문', ${isPublic}, '2001-01-01' from blogs b join users u on u.id = b.owner_id
    where u.username = ${username} returning posts.id`;
  return id as number;
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

  test("관리자는 오래된 남의 글을 글 화면에서 지우고 그 블로그 홈으로, 주인·일반 회원에게는 관리자 [삭제]가 없고 조작해도 남는다", async ({ page, browser }) => {
    const ownerPage = await browser.newPage();
    const owner = await signUpOk(ownerPage);
    const old = await oldPost(owner, "오래된 남의 글");
    const secret = await oldPost(owner, "오래된 비밀 글", false);
    const adminDelete = (p: Page) => p.getByRole("button", { name: "오래된 남의 글 삭제" });

    // 주인에게는 지금처럼 [수정]·[삭제]만 있다
    await ownerPage.goto(`/@${owner}/${old}`);
    await expect(ownerPage.getByRole("button", { name: "삭제", exact: true })).toBeVisible();
    await expect(adminDelete(ownerPage)).toHaveCount(0);

    // 일반 회원에게는 없다
    const member = await browser.newPage();
    await signUpOk(member);
    await member.goto(`/@${owner}/${old}`);
    await expect(member.getByRole("heading", { level: 1, name: "오래된 남의 글" })).toBeVisible();
    await expect(member.getByRole("button", { name: /삭제/ })).toHaveCount(0);

    // 관리자: /admin 최근 글에는 없지만 글 화면에 [삭제]가 있다. 비공개 글은 관리자에게도 404
    await makeAdmin(page);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "👑 관리자" })).toBeVisible();
    await expect(page.locator(`[data-post="${old}"]`)).toHaveCount(0);
    expect((await page.goto(`/@${owner}/${secret}`))!.status()).toBe(404);
    await page.goto(`/@${owner}/${old}`);
    await expect(adminDelete(page)).toHaveText("삭제");
    await expect(page.getByRole("link", { name: "수정" })).toHaveCount(0);
    expect((await adminDelete(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);

    let message = "";
    page.once("dialog", (d) => {
      message = d.message();
      d.dismiss();
    });
    await adminDelete(page).click();
    expect(message).toBe("'오래된 남의 글' 글을 삭제할까요?");
    expect(await sql`select 1 from posts where id = ${old}`).toHaveLength(1);

    // 관리자가 누른 요청을 가로채(보내지 않고) 일반 회원 쿠키로 다시 보내도 글은 남는다
    let captured: { url: string; headers: Record<string, string>; body: string } | null = null;
    await page.route(`**/@${owner}/${old}`, async (route) => {
      const req = route.request();
      if (req.method() === "POST" && req.headers()["next-action"]) {
        captured = { url: req.url(), headers: req.headers(), body: req.postData()! };
        return route.abort();
      }
      return route.continue();
    });
    page.once("dialog", (d) => d.accept());
    await adminDelete(page).click();
    await expect.poll(() => captured !== null).toBe(true);
    await page.unrouteAll();
    const { url, headers: sentHeaders, body } = captured!;
    const headers = Object.fromEntries(Object.entries(sentHeaders).filter(([k]) => k !== "cookie"));
    await member.request.post(url, { headers, data: body });
    expect(await sql`select 1 from posts where id = ${old}`).toHaveLength(1);

    // 확인하면 지워지고 그 블로그 홈으로 간다
    await page.goto(`/@${owner}/${old}`);
    page.once("dialog", (d) => d.accept());
    await adminDelete(page).click();
    await expect(page).toHaveURL(`/@${owner}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await sql`select 1 from posts where id = ${old}`).toHaveLength(0);
    expect((await page.goto(`/@${owner}/${old}`))!.status()).toBe(404);
    await sql`delete from posts where id = ${secret}`;
  });

  test("공지 블로그 주소 notice: 관리자는 그대로 저장·되돌리기가 되고, 일반 회원과 다른 예약어는 안 된다", async ({ page, browser }) => {
    const member = await browser.newPage();
    await signUpOk(member);
    await member.goto("/settings/blog");
    await member.getByLabel("블로그 주소").fill("notice");
    await member.getByRole("button", { name: "주소 바꾸기" }).click();
    await expect(member.locator("p[role=alert]")).toHaveText("이 주소는 쓸 수 없어요");

    const me = await makeAdmin(page);
    const slug = page.getByLabel("블로그 주소");
    const save = page.getByRole("button", { name: "주소 바꾸기" });
    // 개발 DB에 있는 진짜 공지 블로그는 시험 동안 다른 주소로 옮겨 둔다
    const moved = await sql`update blogs set slug = ${uid("nb")} where slug = 'notice' returning id`;
    try {
      await page.goto("/settings/blog");
      await slug.fill("town");
      await save.click();
      await expect(page.locator("p[role=alert]")).toHaveText("이 주소는 쓸 수 없어요");

      await slug.fill("Notice");
      await save.click();
      await expect(page.getByRole("status")).toHaveText("저장했어요 ✓");
      expect((await page.goto("/@notice"))!.status()).toBe(200);

      // 지금 주소 notice를 그대로 두고 눌러도 저장된다
      await page.goto("/settings/blog");
      await expect(slug).toHaveValue("notice");
      await save.click();
      await expect(page.getByRole("status")).toHaveText("저장했어요 ✓");

      // 다른 주소로 바꿨다가 notice로 되돌린다 (앞의 `저장했어요 ✓`가 남지 않게 새로 연다)
      await page.goto("/settings/blog");
      await slug.fill(me);
      await save.click();
      await expect(page.getByRole("status")).toHaveText("저장했어요 ✓");
      expect((await page.goto("/@notice"))!.status()).toBe(404);
      await page.goto("/settings/blog");
      await slug.fill("notice");
      await save.click();
      await expect(page.getByRole("status")).toHaveText("저장했어요 ✓");
      expect((await page.goto("/@notice"))!.status()).toBe(200);
    } finally {
      await sql`update blogs set slug = ${me} where slug = 'notice' and owner_id = (select id from users where username = ${me})`;
      if (moved.length) await sql`update blogs set slug = 'notice' where id = ${moved[0].id}`;
    }
  });
});
