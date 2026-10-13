import { expect, test, type Browser, type Page } from "./fixtures";
import { PASSWORD, signUpOk, sql } from "./helpers";

// 버그·문의 (SUP-01~04, specs/057-support)
test.describe.configure({ timeout: 90_000 });

const TOKEN = process.env.FEEDBACK_BOT_TOKEN ?? "";
const SENT = "접수했어요. 답변이 달리면 알림으로 알려 드릴게요";
const LIMITED = "문의는 한 시간에 5번까지 보낼 수 있어요. 잠시 뒤 다시 보내 주세요";

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

async function send(page: Page, kind: "🐞 버그" | "💬 문의", title: string, content: string) {
  await page.getByRole("radio", { name: kind }).check();
  await page.getByLabel("제목").fill(title);
  await page.getByLabel("내용").fill(content);
  await page.getByRole("button", { name: "보내기" }).click();
}

const mine = (page: Page) => page.getByRole("list", { name: "내 문의 목록" }).getByRole("listitem");

/** 화면을 거치지 않고 문의를 넣는다 */
async function insertFeedback(userId: string, title: string, opts: { createdAt?: string; status?: string } = {}) {
  const [{ id }] = await sql`insert into feedback (user_id, kind, title, content, status, created_at)
    values (${userId}, 'bug', ${title}, '내용', ${opts.status ?? "new"}, ${opts.createdAt ?? sql`now()`}) returning id`;
  return id as number;
}

test.describe("SUP-01 아래 막대", () => {
  test("업데이트 소식·버그·문의하기 버튼이 보이고 문의 버튼은 보던 주소를 넘긴다, 375px에서 넘치지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/feed");
    const footer = page.locator("footer.site-footer");
    const updates = footer.locator("[data-updates-link]");
    const support = footer.getByRole("link", { name: "🐞 버그·문의하기" });
    await expect(updates).toBeVisible();
    await expect(updates).toHaveAttribute("href", "/updates");
    await expect(support).toHaveAttribute("href", "/support?from=%2Ffeed");
    for (const link of [updates, support]) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await support.click();
    await expect(page).toHaveURL(/\/support\?from=%2Ffeed$/);
    await expect(page.getByRole("heading", { level: 1, name: "🐞 버그·문의" })).toBeVisible();
    // 문의 화면에서는 ?from=을 붙이지 않는다
    await expect(support).toHaveAttribute("href", "/support");
  });

  test("휴대폰 회원은 아래 탭에 가리지 않고 누를 수 있다, PC 마을에서는 막대가 없다", async ({ browser }) => {
    const m = await member(browser);
    await m.page.setViewportSize({ width: 375, height: 700 });
    await m.page.goto("/feed");
    const support = m.page.locator("footer.site-footer").getByRole("link", { name: "🐞 버그·문의하기" });
    await support.scrollIntoViewIfNeeded();
    const link = (await support.boundingBox())!;
    const tabs = (await m.page.locator("[data-phone-tabs]").boundingBox())!;
    expect(link.y + link.height).toBeLessThanOrEqual(tabs.y + 1);
    await support.click();
    await expect(m.page).toHaveURL(/\/support\?from=%2Ffeed$/);

    await m.page.setViewportSize({ width: 1280, height: 800 });
    await m.page.goto("/town");
    await expect(m.page.locator("[data-town]")).toBeVisible();
    await expect(m.page.locator("footer.site-footer")).toBeHidden();
  });
});

test.describe("SUP-02 문의 쓰기·내 문의", () => {
  test("방문자는 로그인 링크를 보고, 로그인하면 문의 화면(보던 주소 포함)으로 돌아온다", async ({ browser, page }) => {
    const m = await member(browser);
    await page.goto("/support?from=%2Ffeed");
    await expect(page.getByRole("button", { name: "보내기" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /내 문의/ })).toHaveCount(0);
    await page.locator("[data-support-login]").click();
    await expect(page).toHaveURL(/\/\?next=%2Fsupport%3Ffrom%3D%252Ffeed$/);
    await page.getByLabel("아이디").fill(m.username);
    await page.getByLabel("비밀번호").fill(PASSWORD);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page).toHaveURL(/\/support\?from=%2Ffeed$/);
    await expect(page.getByRole("button", { name: "보내기" })).toBeVisible();
  });

  test("버그와 문의를 보내면 내 문의에 최신순으로 접수로 보이고, 보던 주소·브라우저 정보가 남는다", async ({ browser }) => {
    const m = await member(browser);
    await m.page.goto(`/@${m.username}`);
    await m.page.locator("footer.site-footer").getByRole("link", { name: "🐞 버그·문의하기" }).click();
    await expect(m.page).toHaveURL(new RegExp(`/support\\?from=%2F%40${m.username}$`));
    await expect(m.page.getByText("아직 보낸 문의가 없어요")).toBeVisible();

    await send(m.page, "🐞 버그", "사진이 안 올라가요", "글쓰기에서 사진을 넣으면\n멈춰요 <b>굵게</b>");
    await expect(m.page.locator("[data-support-result]")).toHaveText(SENT);
    await expect(m.page.getByLabel("제목")).toHaveValue("");
    await expect(mine(m.page)).toHaveCount(1);

    await send(m.page, "💬 문의", "레벨은 어떻게 올려요?", "궁금해요");
    await expect(m.page.locator("[data-support-result]")).toHaveText(SENT);
    await expect(mine(m.page)).toHaveCount(2);
    await expect(mine(m.page).nth(0)).toContainText("💬 문의");
    await expect(mine(m.page).nth(0)).toContainText("레벨은 어떻게 올려요?");
    await expect(mine(m.page).nth(1)).toContainText("🐞 버그");
    // 내용은 글자 그대로
    await expect(mine(m.page).nth(1)).toContainText("<b>굵게</b>");
    for (const i of [0, 1]) await expect(mine(m.page).nth(i).locator("[data-feedback-status]")).toHaveText("접수");

    const rows = await sql`select kind, page_path, user_agent, status from feedback where user_id = ${m.userId} order by id`;
    expect(rows.map((r) => [r.kind, r.page_path, r.status])).toEqual([
      ["bug", `/@${m.username}`, "new"],
      ["question", `/@${m.username}`, "new"],
    ]);
    expect(rows[0].user_agent).toContain("Mozilla");
    expect(rows[0].user_agent.length).toBeLessThanOrEqual(300);
  });

  test("다른 사이트 주소는 ?from=으로 남지 않는다", async ({ browser }) => {
    const m = await member(browser);
    await m.page.goto("/support?from=" + encodeURIComponent("//evil.com/x"));
    await send(m.page, "🐞 버그", "주소 시험", "내용");
    await expect(m.page.locator("[data-support-result]")).toHaveText(SENT);
    const [row] = await sql`select page_path from feedback where user_id = ${m.userId}`;
    expect(row.page_path).toBeNull();
  });

  test("한 시간에 5번까지: 한 시간이 지난 것은 세지 않고, 6번째는 막히며 쓴 내용은 남는다", async ({ browser }) => {
    const m = await member(browser);
    for (let i = 0; i < 4; i++) await insertFeedback(m.userId, `옛 문의 ${i}`, { createdAt: new Date(Date.now() - 61 * 60_000).toISOString() });
    for (let i = 0; i < 4; i++) await insertFeedback(m.userId, `최근 문의 ${i}`, { createdAt: new Date(Date.now() - 30 * 60_000).toISOString() });
    await m.page.goto("/support");
    await send(m.page, "🐞 버그", "다섯 번째", "내용");
    await expect(m.page.locator("[data-support-result]")).toHaveText(SENT);
    await send(m.page, "🐞 버그", "여섯 번째", "내용");
    await expect(m.page.locator("[data-support-result]")).toHaveText(LIMITED);
    await expect(m.page.getByLabel("제목")).toHaveValue("여섯 번째");
    expect(await sql`select 1 from feedback where user_id = ${m.userId}`).toHaveLength(9);
    // 내 문의는 10개씩
    await expect(mine(m.page)).toHaveCount(9);
    await insertFeedback(m.userId, "열 번째", { createdAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString() });
    await insertFeedback(m.userId, "열한 번째", { createdAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString() });
    await m.page.reload();
    await expect(mine(m.page)).toHaveCount(10);
    await m.page.getByRole("navigation", { name: "페이지" }).getByRole("link", { name: "2" }).click();
    await expect(m.page).toHaveURL(/\/support\?page=2$/);
    await expect(mine(m.page)).toHaveCount(1);
    await expect(mine(m.page)).toContainText("열한 번째");
  });
});

test.describe("SUP-03 관리자 처리", () => {
  test("관리자가 답하면 쓴 사람이 알림을 받고 답변·상태를 본다, 고침으로 바꾸면 한 번 더 알린다", async ({ browser }) => {
    const m = await member(browser);
    await m.page.goto("/support?from=%2Ffeed");
    await send(m.page, "🐞 버그", "댓글이 두 번 달려요", "한 번 눌렀는데 두 번 달려요");
    await expect(m.page.locator("[data-support-result]")).toHaveText(SENT);
    const [{ id }] = await sql`select id from feedback where user_id = ${m.userId}`;
    // 다른 시험의 문의보다 위에 오도록
    await sql`update feedback set created_at = now() + interval '1 hour' where id = ${id}`;

    const a = await admin(browser);
    await a.page.goto("/admin");
    const count = a.page.locator("[data-feedback-new]");
    expect(Number(await count.getAttribute("data-feedback-new"))).toBeGreaterThanOrEqual(1);
    await a.page.getByRole("link", { name: "문의 보기" }).click();
    await expect(a.page).toHaveURL(/\/admin\/feedback\?status=new$/);
    const item = a.page.locator(`[data-admin-feedback="${id}"]`);
    await expect(item).toContainText("댓글이 두 번 달려요");
    // 접수만 거른 화면에서는 저장하면 목록에서 빠지므로 전체에서 답한다
    await a.page.getByRole("link", { name: "전체" }).click();
    await expect(a.page).toHaveURL(/\/admin\/feedback$/);
    await expect(item).toContainText("한 번 눌렀는데 두 번 달려요");
    await expect(item).toContainText(m.username);
    await expect(item).toContainText("/feed");
    await expect(item).toContainText("Mozilla");
    await expect(item).toContainText("🐞 버그");

    // 상태는 그대로 두고 답변만 달면 답변 완료가 된다
    await item.getByLabel("답변").fill("고쳐 둘게요. 알려 주셔서 고마워요");
    await item.getByRole("button", { name: "저장" }).click();
    await expect(item.getByRole("status")).toHaveText("저장했어요. 쓴 사람에게 알림을 보냈어요");
    let [row] = await sql`select status, reply, replied_by, replied_at from feedback where id = ${id}`;
    expect([row.status, row.reply, row.replied_by]).toEqual(["answered", "고쳐 둘게요. 알려 주셔서 고마워요", "admin"]);
    expect(row.replied_at).not.toBeNull();

    await m.page.goto("/notifications");
    const note = m.page.getByRole("button", { name: "🐞 문의에 답변이 달렸어요: 댓글이 두 번 달려요" });
    await expect(note).toHaveCount(1);
    await note.click();
    await expect(m.page).toHaveURL(/\/support$/);
    const mineItem = mine(m.page).filter({ hasText: "댓글이 두 번 달려요" });
    await expect(mineItem.locator("[data-feedback-status]")).toHaveText("답변 완료");
    await expect(mineItem.locator("[data-feedback-reply]")).toContainText("고쳐 둘게요. 알려 주셔서 고마워요");

    // 고침으로 바꾸면 한 번 더 알림
    await a.page.goto("/admin/feedback");
    await a.page.locator(`[data-admin-feedback="${id}"]`).getByLabel("상태").selectOption("fixed");
    await a.page.locator(`[data-admin-feedback="${id}"]`).getByRole("button", { name: "저장" }).click();
    await expect(a.page.locator(`[data-admin-feedback="${id}"]`).getByRole("status")).toHaveText("저장했어요. 쓴 사람에게 알림을 보냈어요");
    [row] = await sql`select status from feedback where id = ${id}`;
    expect(row.status).toBe("fixed");
    expect(await sql`select 1 from notifications where user_id = ${m.userId} and kind = 'feedback_reply' and feedback_id = ${id}`).toHaveLength(2);
    await m.page.goto("/support");
    await expect(mine(m.page).filter({ hasText: "댓글이 두 번 달려요" }).locator("[data-feedback-status]")).toHaveText("고침");

    // 상태로 거르기
    await a.page.goto("/admin/feedback?status=fixed");
    await expect(a.page.locator(`[data-admin-feedback="${id}"]`)).toBeVisible();
    await a.page.goto("/admin/feedback?status=new");
    await expect(a.page.locator(`[data-admin-feedback="${id}"]`)).toHaveCount(0);
  });

  test("방문자·일반 회원은 /admin/feedback이 404이고, 관리자 저장 요청을 조작해 보내도 바뀌지 않는다", async ({ browser }) => {
    const visitor = await browser.newPage();
    expect((await visitor.goto("/admin/feedback"))!.status()).toBe(404);
    const m = await member(browser);
    expect((await m.page.goto("/admin/feedback"))!.status()).toBe(404);

    const id = await insertFeedback(m.userId, "조작 시험", { createdAt: new Date(Date.now() + 60 * 60_000).toISOString() });
    const a = await admin(browser);
    await a.page.goto("/admin/feedback");
    let captured: { url: string; headers: Record<string, string>; body: string } | null = null;
    await a.page.route("**/admin/feedback", async (route) => {
      const req = route.request();
      if (req.method() === "POST" && req.headers()["next-action"]) {
        captured = { url: req.url(), headers: req.headers(), body: req.postData()! };
        return route.abort();
      }
      return route.continue();
    });
    const item = a.page.locator(`[data-admin-feedback="${id}"]`);
    await item.getByLabel("답변").fill("조작된 답변");
    await item.getByRole("button", { name: "저장" }).click();
    await expect.poll(() => captured !== null).toBe(true);
    const { url, headers: sent, body } = captured!;
    const headers = Object.fromEntries(Object.entries(sent).filter(([k]) => k !== "cookie"));
    await m.page.request.post(url, { headers, data: body });
    let [row] = await sql`select status, reply from feedback where id = ${id}`;
    expect([row.status, row.reply]).toEqual(["new", null]);
    expect(await sql`select 1 from notifications where feedback_id = ${id}`).toHaveLength(0);
    // 같은 요청을 관리자 쿠키로 보내면 바뀐다 (요청 모양이 맞다는 확인)
    await a.page.request.post(url, { headers, data: body });
    [row] = await sql`select status, reply from feedback where id = ${id}`;
    expect([row.status, row.reply]).toEqual(["answered", "조작된 답변"]);
  });
});

test.describe("SUP-04 자동 처리 API", () => {
  test("열쇠가 없거나 틀리면 401, 쿠키로는 들어올 수 없다", async ({ browser, request }) => {
    test.skip(TOKEN.length < 32, "FEEDBACK_BOT_TOKEN이 없으면 API가 꺼져 404다 (단위 시험 checkBotToken)");
    expect((await request.get("/api/feedback")).status()).toBe(401);
    expect((await request.get("/api/feedback", { headers: { authorization: `Bearer ${TOKEN}x` } })).status()).toBe(401);
    expect((await request.get("/api/feedback", { headers: { authorization: TOKEN } })).status()).toBe(401);
    expect((await request.post("/api/feedback/1", { headers: { authorization: "Bearer wrong" }, data: { status: "fixed" } })).status()).toBe(401);
    // 관리자 쿠키가 있어도 열쇠가 없으면 401
    const a = await admin(browser);
    expect((await a.page.request.get("/api/feedback")).status()).toBe(401);
  });

  test("맞는 열쇠로 목록을 받고 답하면 bot 답변이 남고 쓴 사람이 알림을 받는다", async ({ browser, request }) => {
    test.skip(TOKEN.length < 32, "FEEDBACK_BOT_TOKEN이 없으면 API가 꺼져 404다 (단위 시험 checkBotToken)");
    const auth = { authorization: `Bearer ${TOKEN}` };
    const m = await member(browser);
    await m.page.goto("/support?from=%2Fshop");
    await send(m.page, "💬 문의", "코인은 어디서 받아요?", "알려 주세요");
    await expect(m.page.locator("[data-support-result]")).toHaveText(SENT);
    const [{ id }] = await sql`select id from feedback where user_id = ${m.userId}`;
    // 목록은 오래된 것부터라 맨 앞에 오도록
    await sql`update feedback set created_at = '2001-06-01T00:00:00Z' where id = ${id}`;

    const list = await request.get("/api/feedback?status=new,in_progress&limit=5", { headers: auth });
    expect(list.status()).toBe(200);
    expect(list.headers()["cache-control"]).toContain("no-store");
    const { items } = await list.json();
    expect(items.length).toBeLessThanOrEqual(5);
    const mineItem = items.find((i: { id: number }) => i.id === id);
    expect(mineItem).toMatchObject({
      id,
      kind: "question",
      title: "코인은 어디서 받아요?",
      content: "알려 주세요",
      pagePath: "/shop",
      status: "new",
      reply: null,
      author: { username: m.username },
    });
    expect(mineItem.userAgent).toContain("Mozilla");
    expect(new Date(mineItem.createdAt).getUTCFullYear()).toBe(2001);
    // 회원 ID·닉네임은 보내지 않는다
    expect(Object.keys(mineItem).sort()).toEqual(["author", "content", "createdAt", "id", "kind", "pagePath", "reply", "status", "title", "userAgent"]);
    expect(Object.keys(mineItem.author)).toEqual(["username"]);

    expect((await request.get("/api/feedback?status=done", { headers: auth })).status()).toBe(400);
    expect((await request.get("/api/feedback?limit=500", { headers: auth })).status()).toBe(400);

    // 잘못된 본문
    const post = (target: number | string, data: unknown) => request.post(`/api/feedback/${target}`, { headers: auth, data });
    expect((await post(id, {})).status()).toBe(400);
    expect((await post(id, { status: "done" })).status()).toBe(400);
    expect((await post(id, { reply: "   " })).status()).toBe(400);
    expect((await post(id, { reply: "가".repeat(2001) })).status()).toBe(400);
    expect((await post(id, { reply: "답", userId: "x" })).status()).toBe(400);
    expect((await request.post(`/api/feedback/${id}`, { headers: { ...auth, "content-type": "application/json" }, data: "{" })).status()).toBe(400);
    expect((await post(2147483647, { status: "fixed" })).status()).toBe(404);
    expect((await post("abc", { status: "fixed" })).status()).toBe(404);
    expect(await sql`select 1 from notifications where feedback_id = ${id}`).toHaveLength(0);

    // 확인 중으로만 바꾸면 알림 없음
    let res = await post(id, { status: "in_progress" });
    expect(res.status()).toBe(200);
    expect((await res.json()).item).toMatchObject({ id, status: "in_progress", reply: null, notified: false });

    res = await post(id, { reply: "출석하고 글을 쓰면 코인을 받아요" });
    expect(res.status()).toBe(200);
    const { item } = await res.json();
    expect(item).toMatchObject({ id, status: "answered", reply: "출석하고 글을 쓰면 코인을 받아요", repliedBy: "bot", notified: true });
    expect(item.repliedAt).toEqual(expect.any(String));
    const [row] = await sql`select status, replied_by from feedback where id = ${id}`;
    expect([row.status, row.replied_by]).toEqual(["answered", "bot"]);

    await m.page.goto("/notifications");
    await expect(m.page.getByRole("button", { name: "🐞 문의에 답변이 달렸어요: 코인은 어디서 받아요?" })).toBeVisible();
    await m.page.goto("/support");
    const card = mine(m.page).filter({ hasText: "코인은 어디서 받아요?" });
    await expect(card.locator("[data-feedback-status]")).toHaveText("답변 완료");
    await expect(card.locator("[data-feedback-reply]")).toContainText("출석하고 글을 쓰면 코인을 받아요");

    // 답한 것은 new·in_progress 목록에서 빠진다
    const again = await (await request.get("/api/feedback?status=new,in_progress", { headers: auth })).json();
    expect(again.items.some((i: { id: number }) => i.id === id)).toBe(false);
  });
});
