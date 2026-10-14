import { expect, test, type Browser, type Page } from "./fixtures";
import { PASSWORD, signIn, signUpOk, sql, uid, writePost } from "./helpers";

// 관리자 보강 (ADM-01~07, specs/058-admin-tools)
test.describe.configure({ timeout: 90_000 });

async function member(browser: Browser) {
  const page = await browser.newPage();
  const username = await signUpOk(page);
  const [{ id }] = await sql`select id from users where username = ${username}`;
  return { page, username, userId: id as string };
}

async function admin(browser: Browser) {
  const m = await member(browser);
  await sql`update users set role = 'admin' where id = ${m.userId}`;
  return m;
}

/** 회원 관리에서 그 회원을 찾아 [관리]를 연다 */
async function openMember(page: Page, username: string) {
  await page.goto(`/admin/members?q=${username}`);
  const card = page.locator(`[data-admin-member="${username}"]`);
  await card.locator("summary").click();
  return card;
}

const audits = (action: string, targetId: string) => sql`select target_label, detail from admin_audit where action = ${action} and target_id = ${targetId}`;

const PAGES = ["/admin", "/admin/members", "/admin/content", "/admin/content?tab=comments", "/admin/feedback", "/admin/settings", "/admin/audit"];

test.describe("ADM-07 관리자 화면 막기·탭", () => {
  test("방문자·일반 회원은 관리자 화면이 모두 404, 관리자는 탭으로 오간다", async ({ browser }) => {
    const visitor = await browser.newPage();
    const m = await member(browser);
    for (const path of PAGES) {
      expect((await visitor.goto(path))!.status(), path).toBe(404);
      expect((await m.page.goto(path))!.status(), path).toBe(404);
    }
    const a = await admin(browser);
    await a.page.goto("/admin");
    const tabs = a.page.getByRole("navigation", { name: "관리자 메뉴" });
    for (const [name, url] of [
      ["👥 회원", /\/admin\/members$/],
      ["📝 콘텐츠", /\/admin\/content$/],
      ["🐞 버그·문의", /\/admin\/feedback$/],
      ["⚙️ 사이트 설정", /\/admin\/settings$/],
      ["📜 관리 기록", /\/admin\/audit$/],
      ["📊 대시보드", /\/admin$/],
    ] as const) {
      await tabs.getByRole("link", { name }).click();
      await expect(a.page).toHaveURL(url);
      await expect(tabs.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
    }
  });

  test("일반 회원이 관리자 정지 요청을 조작해 보내도 정지되지 않는다", async ({ browser }) => {
    const target = await member(browser);
    const m = await member(browser);
    const a = await admin(browser);
    const card = await openMember(a.page, target.username);
    let captured: { url: string; headers: Record<string, string>; body: string } | null = null;
    await a.page.route("**/admin/members*", async (route) => {
      const req = route.request();
      if (req.method() === "POST" && req.headers()["next-action"]) {
        captured = { url: req.url(), headers: req.headers(), body: req.postData()! };
        return route.abort();
      }
      return route.continue();
    });
    await card.getByLabel("정지 사유").fill("조작 시험");
    a.page.once("dialog", (d) => d.accept());
    await card.getByRole("button", { name: "정지", exact: true }).click();
    await expect.poll(() => captured !== null).toBe(true);
    const { url, headers: sent, body } = captured!;
    const headers = Object.fromEntries(Object.entries(sent).filter(([k]) => k !== "cookie"));
    await m.page.request.post(url, { headers, data: body });
    const [row] = await sql`select suspended_until from users where id = ${target.userId}`;
    expect(row.suspended_until).toBeNull();
  });
});

test.describe("ADM-01 회원 관리", () => {
  test("아이디·닉네임으로 찾고, 정지하면 로그아웃·로그인 거절(기한·사유), 해제하면 다시 로그인된다", async ({ browser }) => {
    const target = await member(browser);
    const a = await admin(browser);

    // 아이디 일부로 찾기, 닉네임으로 찾기
    await a.page.goto(`/admin/members?q=${target.username.slice(0, 8)}`);
    await expect(a.page.locator(`[data-admin-member="${target.username}"]`)).toBeVisible();
    const nickname = uid("닉");
    await sql`update profiles set nickname = ${nickname} where user_id = ${target.userId}`;
    await a.page.goto(`/admin/members?q=${encodeURIComponent(nickname)}`);
    await expect(a.page.locator("[data-admin-member]")).toHaveCount(1);
    await expect(a.page.locator(`[data-admin-member="${target.username}"]`)).toBeVisible();

    // 내 줄에는 관리 칸이 없다
    await a.page.goto(`/admin/members?q=${a.username}`);
    await expect(a.page.locator(`[data-admin-member="${a.username}"]`).locator("summary")).toHaveCount(0);

    // 사유 없이 보내면 서버가 거절 (required를 지워 보낸다)
    let card = await openMember(a.page, target.username);
    await card.getByLabel("정지 기간").selectOption("7");
    await card.getByLabel("정지 사유").evaluate((el) => el.removeAttribute("required"));
    a.page.once("dialog", (d) => d.accept());
    await card.getByRole("button", { name: "정지", exact: true }).click();
    await expect(card.getByRole("alert")).toHaveText("사유를 1~200자로 적어 주세요");

    await card.getByLabel("정지 사유").fill("도배 글");
    a.page.once("dialog", (d) => d.accept());
    await card.getByRole("button", { name: "정지", exact: true }).click();
    await expect(a.page.locator(`[data-admin-member="${target.username}"] [data-suspended]`)).toBeVisible();
    expect(await sql`select 1 from sessions where user_id = ${target.userId}`).toHaveLength(0);
    expect(await audits("suspend", target.userId)).toEqual([{ target_label: target.username, detail: "7일 · 도배 글" }]);

    // 로그인해 있던 화면은 로그아웃, 다시 로그인하면 기한·사유가 보인다
    await target.page.goto("/write");
    await expect(target.page).toHaveURL("/");
    await signIn(target.page, target.username, PASSWORD);
    await expect(target.page.locator("p[role=alert]")).toHaveText(/^이용이 정지된 계정이에요 \(\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}까지, 사유: 도배 글\)$/);
    expect(await sql`select 1 from sessions where user_id = ${target.userId}`).toHaveLength(0);

    // 정지 중에 어떻게든 세션이 생겨도 로그인한 것으로 보지 않는다
    // (정지를 잠깐 풀고 로그인한 뒤 DB에서 다시 정지)
    await sql`update users set suspended_until = null where id = ${target.userId}`;
    await signIn(target.page, target.username, PASSWORD);
    await expect(target.page).toHaveURL("/town");
    await sql`update users set suspended_until = now() + interval '1 day' where id = ${target.userId}`;
    await target.page.goto("/write");
    await expect(target.page).toHaveURL("/");

    // 영구 정지 문구
    await sql`update users set suspended_until = '9999-12-31T00:00:00Z' where id = ${target.userId}`;
    await signIn(target.page, target.username, PASSWORD);
    await expect(target.page.locator("p[role=alert]")).toHaveText("이용이 정지된 계정이에요 (영구 정지, 사유: 도배 글)");

    // 해제
    card = await openMember(a.page, target.username);
    a.page.once("dialog", (d) => d.accept());
    await card.getByRole("button", { name: "정지 풀기" }).click();
    await expect(a.page.locator(`[data-admin-member="${target.username}"] [data-suspended]`)).toHaveCount(0);
    expect(await audits("unsuspend", target.userId)).toHaveLength(1);
    await signIn(target.page, target.username, PASSWORD);
    await expect(target.page).toHaveURL("/town");
  });

  test("관리자 지정·해제, 내 권한은 바꿀 수 없다 (조작해도 거절)", async ({ browser }) => {
    const target = await member(browser);
    const a = await admin(browser);
    let card = await openMember(a.page, target.username);
    a.page.once("dialog", (d) => d.accept());
    await card.getByRole("button", { name: "👑 관리자 지정" }).click();
    await expect(card.getByRole("status")).toHaveText(`${target.username} 님을 관리자로 지정했어요`);
    expect((await sql`select role from users where id = ${target.userId}`)[0].role).toBe("admin");
    // 지정된 회원은 바로 관리자 화면에 들어간다
    expect((await target.page.goto("/admin"))!.status()).toBe(200);

    // 관리자에게는 정지·강제 탈퇴·비밀번호 초기화가 없다
    card = await openMember(a.page, target.username);
    await expect(card.getByRole("button", { name: "정지", exact: true })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "강제 탈퇴" })).toHaveCount(0);

    // a가 자기 권한을 바꾸려 하면 (조작) 거절
    await a.page.goto(`/admin/members?q=${target.username}`);
    card = await openMember(a.page, target.username);
    await card.locator('form[aria-label="관리자 권한"] input[name="userId"]').evaluate((el, v) => ((el as HTMLInputElement).value = v), a.userId);
    a.page.once("dialog", (d) => d.accept());
    await card.getByRole("button", { name: "관리자 해제" }).click();
    await expect(card.getByRole("alert")).toHaveText("내 계정에는 할 수 없어요");
    expect((await sql`select role from users where id = ${a.userId}`)[0].role).toBe("admin");

    // 해제
    card = await openMember(a.page, target.username);
    a.page.once("dialog", (d) => d.accept());
    await card.getByRole("button", { name: "관리자 해제" }).click();
    await expect(card.getByRole("status")).toHaveText(`${target.username} 님의 관리자 권한을 해제했어요`);
    expect((await sql`select role from users where id = ${target.userId}`)[0].role).toBe("user");
    expect((await target.page.goto("/admin"))!.status()).toBe(404);
    expect(await audits("grant_admin", target.userId)).toHaveLength(1);
    expect(await audits("revoke_admin", target.userId)).toHaveLength(1);
  });

  test("강제 탈퇴: 확인 창을 거쳐 회원과 블로그가 지워지고, 관리자·나 자신은 거절", async ({ browser }) => {
    const target = await member(browser);
    await writePost(target.page, "탈퇴될 글", "본문");
    const a = await admin(browser);
    const card = await openMember(a.page, target.username);
    a.page.once("dialog", (d) => d.dismiss());
    await card.getByRole("button", { name: "강제 탈퇴" }).click();
    await a.page.waitForTimeout(300);
    expect(await sql`select 1 from users where id = ${target.userId}`).toHaveLength(1);

    let message = "";
    a.page.once("dialog", (d) => {
      message = d.message();
      d.accept();
    });
    await card.getByRole("button", { name: "강제 탈퇴" }).click();
    await expect(a.page.locator(`[data-admin-member="${target.username}"]`)).toHaveCount(0);
    expect(message).toContain(`${target.username} 님을 강제 탈퇴시킬까요?`);
    expect(await sql`select 1 from users where id = ${target.userId}`).toHaveLength(0);
    expect(await sql`select 1 from blogs where slug = ${target.username}`).toHaveLength(0);
    expect(await audits("delete_member", target.userId)).toEqual([{ target_label: target.username, detail: null }]);
    expect((await target.page.goto(`/@${target.username}`))!.status()).toBe(404);

    // 다른 관리자를 겨눈 조작 요청은 거절
    const other = await admin(browser);
    const victim = await member(browser);
    const vcard = await openMember(a.page, victim.username);
    await vcard.locator('form[aria-label="강제 탈퇴"] input[name="userId"]').evaluate((el, v) => ((el as HTMLInputElement).value = v), other.userId);
    a.page.once("dialog", (d) => d.accept());
    await vcard.getByRole("button", { name: "강제 탈퇴" }).click();
    await expect(vcard.getByRole("alert")).toHaveText("관리자에게는 할 수 없어요. 먼저 관리자 권한을 빼 주세요");
    expect(await sql`select 1 from users where id = ${other.userId}`).toHaveLength(1);
  });
});

test.describe("ADM-02 콘텐츠 관리", () => {
  test("글·댓글·답글·방명록을 최신순으로 보고(비밀 내용 포함) 골라 지운다", async ({ browser }) => {
    const owner = await member(browser);
    const postId = await writePost(owner.page, "지울 글", "지울 글 본문");
    const keepId = await writePost(owner.page, "남길 글", "본문");
    const [{ id: commentId }] = await sql`insert into comments (post_id, author_id, content, is_secret, created_at)
      values (${keepId}, ${owner.userId}, '비밀 댓글 내용', true, now() + interval '2 hours') returning id`;
    const [{ id: replyId }] = await sql`insert into replies (comment_id, author_id, content, created_at)
      values (${commentId}, ${owner.userId}, '지울 답글', now() + interval '2 hours') returning id`;
    const [{ id: entryId }] = await sql`insert into guestbook_entries (blog_id, author_id, content, is_secret, created_at)
      select b.id, ${owner.userId}, '비밀 방명록 내용', true, now() + interval '2 hours' from blogs b where b.owner_id = ${owner.userId} returning id`;
    await sql`update posts set created_at = now() + interval '2 hours' where id in ${sql([postId, keepId])}`;

    const a = await admin(browser);
    await a.page.goto("/admin/content");
    const postRow = a.page.locator(`[data-admin-content="post:${postId}"]`);
    await expect(postRow).toContainText("지울 글 본문");
    await expect(postRow).toContainText(owner.username);
    await expect(postRow.getByRole("link", { name: "지울 글" })).toHaveAttribute("href", `/@${owner.username}/${postId}`);

    // 고르지 않고 누르면 안내
    await a.page.getByRole("button", { name: "선택 삭제" }).click();
    await expect(a.page.getByRole("form", { name: "선택 삭제" }).getByRole("alert")).toHaveText("지울 항목을 골라 주세요");

    await postRow.getByRole("checkbox").check();
    let message = "";
    a.page.once("dialog", (d) => {
      message = d.message();
      d.accept();
    });
    await a.page.getByRole("button", { name: "선택 삭제" }).click();
    await expect(a.page.getByRole("form", { name: "선택 삭제" }).getByRole("status")).toHaveText("1개를 삭제했어요");
    expect(message).toBe("선택한 1개를 삭제할까요? 되돌릴 수 없어요.");
    await expect(postRow).toHaveCount(0);
    expect(await sql`select 1 from posts where id = ${postId}`).toHaveLength(0);
    expect(await sql`select 1 from posts where id = ${keepId}`).toHaveLength(1);

    // 댓글·답글: 비밀 댓글도 내용이 보이고, 지우면 자리만 남는다 (기존 삭제와 같다)
    await a.page.getByRole("link", { name: "댓글·답글" }).click();
    await expect(a.page).toHaveURL(/tab=comments/);
    const cRow = a.page.locator(`[data-admin-content="comment:${commentId}"]`);
    const rRow = a.page.locator(`[data-admin-content="reply:${replyId}"]`);
    await expect(cRow).toContainText("🔒");
    await expect(cRow).toContainText("비밀 댓글 내용");
    await cRow.getByRole("checkbox").check();
    await rRow.getByRole("checkbox").check();
    a.page.once("dialog", (d) => d.accept());
    await a.page.getByRole("button", { name: "선택 삭제" }).click();
    await expect(a.page.getByRole("form", { name: "선택 삭제" }).getByRole("status")).toHaveText("2개를 삭제했어요");
    await expect(cRow).toHaveCount(0);
    const [c] = await sql`select content, deleted_at from comments where id = ${commentId}`;
    expect(c.content).toBe("");
    expect(c.deleted_at).not.toBeNull();
    expect((await sql`select deleted_at from replies where id = ${replyId}`)[0].deleted_at).not.toBeNull();

    // 방명록
    await a.page.getByRole("link", { name: "방명록" }).click();
    const gRow = a.page.locator(`[data-admin-content="guestbook:${entryId}"]`);
    await expect(gRow).toContainText("비밀 방명록 내용");
    await expect(gRow.getByRole("link")).toHaveAttribute("href", `/@${owner.username}/guestbook`);
    await gRow.getByRole("checkbox").check();
    a.page.once("dialog", (d) => d.accept());
    await a.page.getByRole("button", { name: "선택 삭제" }).click();
    await expect(gRow).toHaveCount(0);
    expect(await sql`select 1 from guestbook_entries where id = ${entryId}`).toHaveLength(0);

    for (const [action, id] of [
      ["delete_post", postId],
      ["delete_comment", commentId],
      ["delete_reply", replyId],
      ["delete_guestbook", entryId],
    ] as const) {
      expect(await audits(action, String(id)), action).toHaveLength(1);
    }

    // 일반 회원에게는 /admin/content 자체가 404 (위에서 확인), 남은 글은 그대로
    expect((await owner.page.goto(`/@${owner.username}/${keepId}`))!.status()).toBe(200);
  });

  test("블라인드: 글이 비공개로 바뀌고 작성자는 다시 공개할 수 없다, 해제하면 다시 공개할 수 있다", async ({ browser }) => {
    const owner = await member(browser);
    const postId = await writePost(owner.page, "가릴 글", "본문");
    await sql`update posts set created_at = now() + interval '3 hours' where id = ${postId}`;
    const a = await admin(browser);
    await a.page.goto("/admin/content");
    const row = a.page.locator(`[data-admin-content="post:${postId}"]`);
    await row.getByText("블라인드", { exact: true }).click();
    await row.getByLabel("블라인드 사유").fill("광고");
    a.page.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: "가리기" }).click();
    await expect(row).toContainText("🚫 블라인드");
    const [p] = await sql`select is_public, blind_reason from posts where id = ${postId}`;
    expect([p.is_public, p.blind_reason]).toEqual([false, "광고"]);
    // 다른 사람에게는 404, 작성자에게는 안내
    expect((await a.page.goto(`/@${owner.username}/${postId}`))!.status()).toBe(404);
    await owner.page.goto(`/@${owner.username}/${postId}`);
    await expect(owner.page.locator("[data-blind-notice]")).toContainText("사유: 광고");

    await a.page.goto("/admin/content");
    a.page.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: "블라인드 해제" }).click();
    await expect(row).not.toContainText("🚫 블라인드");
    expect((await sql`select blinded_at from posts where id = ${postId}`)[0].blinded_at).toBeNull();
    expect(await audits("blind_post", String(postId))).toHaveLength(1);
    expect(await audits("unblind_post", String(postId))).toHaveLength(1);
  });
});

test.describe("ADM-03 통계", () => {
  test("대시보드에 최근 7·30일 가입자·글·댓글·방문 막대와 합계, 방문 많은 블로그", async ({ browser }) => {
    const a = await admin(browser);
    await a.page.goto("/admin");
    const section = a.page.locator("[data-activity-range]");
    await expect(section).toHaveAttribute("data-activity-range", "7");
    await expect(section.locator("[data-chart]")).toHaveCount(4);
    for (const metric of ["signups", "posts", "comments", "visits"]) {
      const chart = section.locator(`[data-chart="${metric}"]`);
      await expect(chart.locator("ol > li")).toHaveCount(7);
      await expect(chart.locator("[data-chart-total]")).toHaveText(/^[\d,]+$/);
    }
    // 오늘 가입한 관리자 자신이 가입자 합계에 들어 있다
    expect(Number((await section.locator('[data-chart="signups"] [data-chart-total]').textContent())!.replace(/,/g, ""))).toBeGreaterThanOrEqual(1);
    await expect(a.page.getByRole("heading", { name: "🏆 최근 30일 방문 많은 블로그" })).toBeVisible();

    await section.getByRole("link", { name: "30일" }).click();
    await expect(a.page).toHaveURL(/\/admin\?range=30$/);
    await expect(a.page.locator('[data-activity-range="30"] [data-chart="visits"] ol > li')).toHaveCount(30);
    // 기존 통계 카드도 그대로
    await expect(a.page.locator("[data-stat]")).toHaveCount(4);
  });
});

// 공지 띠·금지어는 사이트 전체 설정이라 같은 일꾼에서 차례로 돌고, 끝나면 되돌린다
test.describe("ADM-04·05 사이트 설정", () => {
  test.describe.configure({ mode: "serial" });

  test("공지 띠: 모든 화면 위에 보이고, 닫으면 이 브라우저에서 안 보이며, 다시 저장하면 또 보인다. PC 마을에는 없다", async ({ browser }) => {
    const [saved] = await sql`select value, updated_at from site_settings where key = 'notice'`;
    const a = await admin(browser);
    const m = await member(browser);
    try {
      await a.page.goto("/admin/settings");
      // 밖 주소 링크는 거절
      await a.page.getByLabel(/공지 문구/).fill("점검 안내");
      await a.page.getByLabel(/링크/).fill("https://evil.example");
      await a.page.getByLabel("모든 화면 위에 보이기").check();
      await a.page.getByRole("button", { name: "공지 띠 저장" }).click();
      await expect(a.page.getByRole("form", { name: "공지 띠" }).getByRole("alert")).toHaveText("링크는 이 사이트 안의 주소(/로 시작)만 쓸 수 있어요");

      const text = `오늘 밤 점검 ${uid("n")}`;
      await a.page.getByLabel(/공지 문구/).fill(text);
      await a.page.getByLabel(/링크/).fill("/updates");
      await a.page.getByRole("button", { name: "공지 띠 저장" }).click();
      await expect(a.page.getByRole("form", { name: "공지 띠" }).getByRole("status")).toHaveText("공지 띠를 저장했어요");

      const bar = m.page.locator("[data-site-notice]");
      for (const path of ["/feed", `/@${m.username}`, "/support"]) {
        await m.page.goto(path);
        await expect(bar).toContainText(text);
      }
      await expect(bar.getByRole("link", { name: text })).toHaveAttribute("href", "/updates");
      await m.page.getByRole("button", { name: "공지 닫기" }).click();
      await expect(bar).toHaveCount(0);
      await m.page.goto("/feed");
      await m.page.waitForTimeout(300);
      await expect(bar).toHaveCount(0);

      // PC 마을 화면에는 없다
      await a.page.setViewportSize({ width: 1280, height: 800 });
      await a.page.goto("/town");
      await expect(a.page.locator("[data-town]")).toBeVisible();
      await expect(a.page.locator("[data-site-notice]")).toBeHidden();

      // 다시 저장하면 닫았던 브라우저에도 또 보인다
      const text2 = `점검 시간 바뀜 ${uid("n")}`;
      await a.page.goto("/admin/settings");
      await a.page.getByLabel(/공지 문구/).fill(text2);
      await a.page.getByRole("button", { name: "공지 띠 저장" }).click();
      await expect(a.page.getByRole("form", { name: "공지 띠" }).getByRole("status")).toBeVisible();
      await m.page.goto("/feed");
      await expect(bar).toContainText(text2);

      // 끄면 사라진다
      await a.page.getByLabel("모든 화면 위에 보이기").uncheck();
      await a.page.getByRole("button", { name: "공지 띠 저장" }).click();
      await expect(a.page.getByRole("form", { name: "공지 띠" }).getByRole("status")).toHaveText("공지 띠를 저장했어요 (꺼 둠)");
      await m.page.goto("/feed");
      await m.page.waitForTimeout(300);
      await expect(bar).toHaveCount(0);
      expect((await sql`select 1 from admin_audit a join users u on u.id = a.admin_id where a.action = 'notice' and u.username = ${a.username}`).length).toBe(3);
    } finally {
      if (saved) await sql`update site_settings set value = ${saved.value}, updated_at = ${saved.updated_at} where key = 'notice'`;
      else await sql`delete from site_settings where key = 'notice'`;
    }
  });

  test("금지어: 글·댓글·방명록·문의 저장을 막는다 (대소문자 무시), 관리 기록에 남는다", async ({ browser }) => {
    const [saved] = await sql`select value from site_settings where key = 'banned_words'`;
    const word = uid("Ban").toLowerCase();
    const a = await admin(browser);
    const m = await member(browser);
    const owner = await member(browser);
    const postId = await writePost(owner.page, "금지어 시험 글", "본문");
    try {
      await a.page.goto("/admin/settings");
      const box = a.page.getByRole("textbox", { name: /^금지어/ });
      // 30자 넘는 줄은 거절
      await box.fill("가".repeat(31));
      await a.page.getByRole("button", { name: "금지어 저장" }).click();
      await expect(a.page.getByRole("form", { name: "금지어" }).getByRole("alert")).toContainText("1~30자");
      await box.fill([...(saved?.value ? saved.value.split("\n") : []), word].join("\n"));
      await a.page.getByRole("button", { name: "금지어 저장" }).click();
      await expect(a.page.getByRole("form", { name: "금지어" }).getByRole("status")).toContainText("금지어");
      const message = `사용할 수 없는 말이 들어 있어요: ${word}`;

      // 글 (제목에 대문자로)
      await m.page.goto("/write");
      await m.page.getByLabel("제목", { exact: true }).fill(`제목 ${word.toUpperCase()}`);
      await m.page.getByLabel("본문").click();
      await m.page.keyboard.type("평범한 본문");
      await m.page.getByRole("button", { name: "발행하기" }).click();
      await expect(m.page.locator("p[role=alert]")).toHaveText(message);
      await expect(m.page).toHaveURL(/\/write$/);

      // 댓글
      await m.page.goto(`/@${owner.username}/${postId}`);
      const comments = m.page.locator("#comments");
      await comments.getByRole("textbox", { name: "댓글", exact: true }).fill(`이 글 ${word} 이에요`);
      await comments.getByRole("button", { name: "댓글 등록" }).click();
      await expect(comments.getByRole("alert")).toHaveText(message);
      expect(await sql`select 1 from comments where post_id = ${postId}`).toHaveLength(0);

      // 방명록
      await m.page.goto(`/@${owner.username}/guestbook`);
      await m.page.getByRole("textbox", { name: "방명록", exact: true }).fill(`안녕 ${word}`);
      await m.page.getByRole("button", { name: "방명록 남기기" }).click();
      await expect(m.page.locator("main").getByRole("alert")).toHaveText(message);
      expect(await sql`select 1 from guestbook_entries where author_id = ${m.userId}`).toHaveLength(0);

      // 문의
      await m.page.goto("/support");
      await m.page.getByRole("radio", { name: "💬 문의" }).check();
      await m.page.getByLabel("제목").fill("궁금해요");
      await m.page.getByLabel("내용").fill(`내용 ${word}`);
      await m.page.getByRole("button", { name: "보내기" }).click();
      await expect(m.page.locator("[data-support-result]")).toHaveText(message);
      expect(await sql`select 1 from feedback where user_id = ${m.userId}`).toHaveLength(0);

      // 금지어가 없으면 그대로 저장된다
      await m.page.goto(`/@${owner.username}/${postId}`);
      await comments.getByRole("textbox", { name: "댓글", exact: true }).fill("좋은 글이에요");
      await comments.getByRole("button", { name: "댓글 등록" }).click();
      await expect(comments.getByText("좋은 글이에요")).toBeVisible();

      const [log] = await sql`select detail from admin_audit a join users u on u.id = a.admin_id where a.action = 'banned_words' and u.username = ${a.username}`;
      expect(log.detail).toContain(`추가: ${word}`);
    } finally {
      if (saved) await sql`update site_settings set value = ${saved.value} where key = 'banned_words'`;
      else await sql`delete from site_settings where key = 'banned_words'`;
      // 서버가 잠깐(30초) 기억한 목록에 시험 단어가 남아도 다른 시험에는 나오지 않는 단어다
    }
  });
});

test.describe("ADM-06 관리 기록", () => {
  test("관리자가 한 일이 최신순으로 보이고 종류로 거른다, 비밀번호 초기화·문의 답변도 남는다", async ({ browser }) => {
    const target = await member(browser);
    const a = await admin(browser);
    // 비밀번호 초기화 (기존 /admin 회원 찾기)
    await a.page.goto("/admin");
    await a.page.getByLabel("찾을 아이디").fill(target.username);
    await a.page.getByRole("button", { name: "찾기" }).click();
    a.page.once("dialog", (d) => d.accept());
    await a.page.locator(`[data-found-member="${target.username}"]`).getByRole("button", { name: "비밀번호 초기화" }).click();
    await expect(a.page.locator("[data-temp-password]")).toBeVisible();
    const temp = (await a.page.locator("[data-temp-password]").textContent())!;

    // 문의 답변
    const [{ id: feedbackId }] = await sql`insert into feedback (user_id, kind, title, content) values (${target.userId}, 'question', '기록 시험 문의', '내용') returning id`;
    await a.page.goto("/admin/feedback");
    const item = a.page.locator(`[data-admin-feedback="${feedbackId}"]`);
    await item.getByLabel("답변").fill("확인했어요");
    await item.getByRole("button", { name: "저장" }).click();
    await expect(item.getByRole("status")).toContainText("저장했어요");

    await a.page.goto("/admin/audit");
    const reset = a.page.locator(`[data-audit="reset_password"][data-audit-target="${target.userId}"]`);
    await expect(reset).toContainText("비밀번호 초기화");
    await expect(reset).toContainText(target.username);
    await expect(reset).toContainText(`by ${a.username}`);
    await expect(reset).not.toContainText(temp);
    const fb = a.page.locator(`[data-audit="feedback"][data-audit-target="${feedbackId}"]`);
    await expect(fb).toContainText("기록 시험 문의");
    await expect(fb).toContainText("답변: 확인했어요");

    await a.page.getByLabel("종류").selectOption("reset_password");
    await a.page.getByRole("button", { name: "거르기" }).click();
    await expect(a.page).toHaveURL(/\/admin\/audit\?action=reset_password$/);
    await expect(a.page.locator("[data-audit]").first()).toHaveAttribute("data-audit", "reset_password");
    expect(await a.page.locator("[data-audit]:not([data-audit='reset_password'])").count()).toBe(0);
    await expect(fb).toHaveCount(0);
  });

  test("375px에서 관리자 화면들이 가로로 넘치지 않는다", async ({ browser }) => {
    const a = await admin(browser);
    await a.page.setViewportSize({ width: 375, height: 800 });
    for (const path of PAGES) {
      await a.page.goto(path);
      expect(await a.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
    }
  });
});
