import { expect, test, type Browser, type Page } from "./fixtures";
import { signUpOk, sql } from "./helpers";

// 🚨 신고하기 (specs/059-report-bookmarks)
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

/** 화면을 거치지 않고 글 하나 (글 ID) */
async function insertPost(username: string, title: string, isPublic = true): Promise<number> {
  const [row] = await sql`insert into posts (blog_id, title, content_html, content_text, is_public)
    select b.id, ${title}, ${"<p>" + title + " 본문</p>"}, ${title + " 본문"}, ${isPublic} from blogs b join users u on u.id = b.owner_id where u.username = ${username}
    returning id`;
  return row.id as number;
}

async function insertComment(postId: number, authorId: string, content: string): Promise<number> {
  const [row] = await sql`insert into comments (post_id, author_id, content) values (${postId}, ${authorId}, ${content}) returning id`;
  return row.id as number;
}

async function insertReply(commentId: number, authorId: string, content: string): Promise<number> {
  const [row] = await sql`insert into replies (comment_id, author_id, content) values (${commentId}, ${authorId}, ${content}) returning id`;
  return row.id as number;
}

async function insertEntry(blogOwner: string, authorId: string, content: string): Promise<number> {
  const [row] = await sql`insert into guestbook_entries (blog_id, author_id, content)
    select b.id, ${authorId}, ${content} from blogs b join users u on u.id = b.owner_id where u.username = ${blogOwner} returning id`;
  return row.id as number;
}

const reportsOf = (type: string, id: number) => sql`select reporter_id, reason, detail, status, resolved_by from reports where target_type = ${type} and target_id = ${id} order by id`;

/** 신고 대화 상자를 열어 사유를 고르고 보낸다. 대화 상자를 돌려준다 */
async function report(page: Page, scope: ReturnType<Page["locator"]>, reason: string, detail?: string) {
  await scope.getByRole("button", { name: "🚨 신고" }).click();
  const dialog = page.locator("dialog[open][data-report-dialog]");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("신고 사유").selectOption({ label: reason });
  if (detail !== undefined) await dialog.getByLabel("설명").fill(detail);
  await dialog.getByRole("button", { name: "신고하기" }).click();
  return dialog;
}

/** 다음 신고 Server Action 요청을 가로채 보내지 않고 돌려준다 (조작 시험용) */
async function captureAction(page: Page, urlGlob: string, trigger: () => Promise<void>, match = "targetType") {
  let captured: { url: string; headers: Record<string, string>; body: string } | null = null;
  await page.route(urlGlob, async (route) => {
    const req = route.request();
    if (req.method() === "POST" && req.headers()["next-action"] && captured === null && (req.postData() ?? "").includes(match)) {
      captured = { url: req.url(), headers: req.headers(), body: req.postData()! };
      return route.abort();
    }
    return route.continue();
  });
  await trigger();
  await expect.poll(() => captured !== null).toBe(true);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  const { url, headers: sent, body } = captured!;
  const headers = Object.fromEntries(Object.entries(sent).filter(([k]) => k !== "cookie" && k !== "content-length"));
  return { url, headers, body };
}

test.describe("회원 신고", () => {
  test("남의 글을 신고하면 접수되고, 다시 신고하면 '이미 신고했어요'. 내 글·방문자에게는 버튼이 없다", async ({ browser }) => {
    const author = await member(browser);
    const reader = await member(browser);
    const postId = await insertPost(author.username, "신고 대상 글");
    const path = `/@${author.username}/${postId}`;

    await reader.page.goto(path);
    const actions = reader.page.locator("[data-post-actions]");
    const dialog = await report(reader.page, actions, "스팸·광고");
    await expect(dialog.getByRole("status")).toHaveText("신고했어요. 관리자가 확인할게요");
    await dialog.getByRole("button", { name: "닫기" }).click();
    await expect(dialog).toBeHidden();
    expect(await reportsOf("post", postId)).toEqual([{ reporter_id: reader.userId, reason: "spam", detail: null, status: "open", resolved_by: null }]);

    const again = await report(reader.page, actions, "욕설·비방");
    await expect(again.getByRole("status")).toHaveText("이미 신고했어요");
    expect(await reportsOf("post", postId)).toHaveLength(1);

    // 내 글에는 신고 버튼이 없다
    await author.page.goto(path);
    await expect(author.page.getByRole("heading", { name: "신고 대상 글" })).toBeVisible();
    await expect(author.page.getByRole("button", { name: "🚨 신고" })).toHaveCount(0);
    // 방문자에게도 없다
    const visitor = await browser.newPage();
    await visitor.goto(path);
    await expect(visitor.getByRole("heading", { name: "신고 대상 글" })).toBeVisible();
    await expect(visitor.getByRole("button", { name: "🚨 신고" })).toHaveCount(0);
  });

  test("댓글·답글·방명록을 신고한다. 기타는 설명이 있어야 하고, 내 댓글에는 버튼이 없다", async ({ browser }) => {
    const owner = await member(browser);
    const writer = await member(browser);
    const reader = await member(browser);
    const postId = await insertPost(owner.username, "댓글 신고 글");
    const commentId = await insertComment(postId, writer.userId, "나쁜 댓글이에요");
    const replyId = await insertReply(commentId, writer.userId, "나쁜 답글이에요");
    const mine = await insertComment(postId, reader.userId, "내가 쓴 댓글");
    const entryId = await insertEntry(owner.username, writer.userId, "나쁜 방명록이에요");

    await reader.page.goto(`/@${owner.username}/${postId}`);
    const comment = reader.page.locator(`#comment-${commentId}`);
    // 기타는 설명이 꼭 있어야 한다 (브라우저 확인을 건너뛰어도 서버가 거절한다)
    await comment.getByRole("button", { name: "🚨 신고" }).click();
    const dialog = reader.page.locator("dialog[open][data-report-dialog]");
    await dialog.getByLabel("신고 사유").selectOption({ label: "기타" });
    await dialog.getByLabel("설명").evaluate((el) => el.removeAttribute("required"));
    await dialog.getByRole("button", { name: "신고하기" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("기타 사유는 설명을 1~300자로 적어 주세요");
    await dialog.getByLabel("설명").fill("  도배를 해요  ");
    await dialog.getByRole("button", { name: "신고하기" }).click();
    await expect(dialog.getByRole("status")).toHaveText("신고했어요. 관리자가 확인할게요");
    await dialog.getByRole("button", { name: "닫기" }).click();
    expect(await reportsOf("comment", commentId)).toEqual([{ reporter_id: reader.userId, reason: "other", detail: "도배를 해요", status: "open", resolved_by: null }]);

    const reply = await report(reader.page, reader.page.locator(`#reply-${replyId}`), "개인정보 노출");
    await expect(reply.getByRole("status")).toHaveText("신고했어요. 관리자가 확인할게요");
    await reply.getByRole("button", { name: "닫기" }).click();
    expect((await reportsOf("reply", replyId)).map((r) => r.reason)).toEqual(["privacy"]);
    await expect(reader.page.locator(`#comment-${mine}`).getByRole("button", { name: "🚨 신고" })).toHaveCount(0);

    await reader.page.goto(`/@${owner.username}/guestbook`);
    const entry = await report(reader.page, reader.page.locator(`#entry-${entryId}`), "음란·불쾌");
    await expect(entry.getByRole("status")).toHaveText("신고했어요. 관리자가 확인할게요");
    expect((await reportsOf("guestbook", entryId)).map((r) => r.reason)).toEqual(["obscene"]);
    // 방명록을 쓴 사람에게는 자기 방명록 신고 버튼이 없다
    await writer.page.goto(`/@${owner.username}/guestbook`);
    await expect(writer.page.locator(`#entry-${entryId}`)).toBeVisible();
    await expect(writer.page.locator(`#entry-${entryId}`).getByRole("button", { name: "🚨 신고" })).toHaveCount(0);
  });

  test("조작한 요청: 내 글·볼 수 없는 글·지운 댓글·방문자는 저장되지 않고, 1시간 10번을 넘으면 거절", async ({ browser }) => {
    const author = await member(browser);
    const reader = await member(browser);
    const postId = await insertPost(author.username, "조작 시험 글");
    const privateId = await insertPost(author.username, "비공개 글", false);
    const deletedComment = await insertComment(postId, author.userId, "지울 댓글");
    await sql`update comments set deleted_at = now(), content = '' where id = ${deletedComment}`;

    await reader.page.goto(`/@${author.username}/${postId}`);
    const { url, headers, body } = await captureAction(reader.page, `**/@${author.username}/${postId}`, async () => {
      await report(reader.page, reader.page.locator("[data-post-actions]"), "스팸·광고");
    });
    const forge = (type: string, id: number) => body.replace(/(targetType"\r\n\r\n)[a-z]+/, `$1${type}`).replace(/(targetId"\r\n\r\n)\d+/, `$1${id}`);
    expect(forge("comment", 5)).not.toBe(body);

    // 글쓴이가 자기 글을 신고하는 요청
    await author.page.request.post(url, { headers, data: body });
    // 볼 수 없는 비공개 글, 지운 댓글
    await reader.page.request.post(url, { headers, data: forge("post", privateId) });
    await reader.page.request.post(url, { headers, data: forge("comment", deletedComment) });
    // 방문자
    const visitor = await browser.newPage();
    await visitor.request.post(url, { headers, data: body });
    expect(await reportsOf("post", postId)).toEqual([]);
    expect(await reportsOf("post", privateId)).toEqual([]);
    expect(await reportsOf("comment", deletedComment)).toEqual([]);

    // 1시간에 10번까지: 이미 10번 보낸 회원
    const targets = await Promise.all(Array.from({ length: 10 }, (_, i) => insertComment(postId, author.userId, `댓글 ${i}`)));
    for (const id of targets) await sql`insert into reports (reporter_id, target_type, target_id, reason) values (${reader.userId}, 'comment', ${id}, 'spam')`;
    await reader.page.goto(`/@${author.username}/${postId}`);
    const dialog = await report(reader.page, reader.page.locator("[data-post-actions]"), "스팸·광고");
    await expect(dialog.getByRole("alert")).toHaveText("신고가 너무 많아요. 잠시 뒤에 다시 해 주세요");
    expect(await reportsOf("post", postId)).toEqual([]);
    // 한 시간이 지나면 다시 된다
    await sql`update reports set created_at = now() - interval '61 minutes' where reporter_id = ${reader.userId}`;
    await dialog.getByRole("button", { name: "신고하기" }).click();
    await expect(dialog.getByRole("status")).toHaveText("신고했어요. 관리자가 확인할게요");
  });
});

test.describe("관리자 신고 처리", () => {
  test("대상별로 묶어 보고 블라인드·삭제·기각한다. 처리하면 신고가 닫히고 관리 기록이 남는다", async ({ browser }) => {
    const author = await member(browser);
    const r1 = await member(browser);
    const r2 = await member(browser);
    const a = await admin(browser);
    const postId = await insertPost(author.username, "신고 많이 받은 글");
    const commentId = await insertComment(postId, author.userId, "지워질 댓글");
    const entryId = await insertEntry(r1.username, author.userId, "기각될 방명록");
    for (const r of [r1, r2]) await sql`insert into reports (reporter_id, target_type, target_id, reason) values (${r.userId}, 'post', ${postId}, 'spam')`;
    await sql`insert into reports (reporter_id, target_type, target_id, reason, detail) values (${r1.userId}, 'comment', ${commentId}, 'other', '도배 댓글')`;
    await sql`insert into reports (reporter_id, target_type, target_id, reason) values (${r2.userId}, 'guestbook', ${entryId}, 'abuse')`;

    // 일반 회원에게는 신고 화면이 없다
    expect((await r1.page.goto("/admin/reports"))!.status()).toBe(404);

    await a.page.goto("/admin");
    await expect(a.page.locator("[data-reports-open]")).toBeVisible();
    expect(Number(await a.page.locator("[data-reports-open]").getAttribute("data-reports-open"))).toBeGreaterThanOrEqual(4);
    await a.page.getByRole("navigation", { name: "관리자 메뉴" }).getByRole("link", { name: "🚨 신고" }).click();
    await expect(a.page).toHaveURL(/\/admin\/reports$/);

    const post = a.page.locator(`[data-report-group="post:${postId}"]`);
    await expect(post).toContainText("신고 2건");
    await expect(post).toContainText("스팸·광고 2");
    await expect(post.getByRole("link", { name: "글 보기" })).toHaveAttribute("href", `/@${author.username}/${postId}`);
    const comment = a.page.locator(`[data-report-group="comment:${commentId}"]`);
    await expect(comment).toContainText("지워질 댓글");
    await expect(comment).toContainText("기타: 도배 댓글");
    await expect(a.page.locator(`[data-report-group="guestbook:${entryId}"]`)).toContainText("기각될 방명록");

    // 일반 회원이 관리자 기각 요청을 조작해 보내도 바뀌지 않는다
    const guest = a.page.locator(`[data-report-group="guestbook:${entryId}"]`);
    const forged = await captureAction(a.page, "**/admin/reports*", async () => {
      a.page.once("dialog", (d) => d.accept());
      await guest.getByRole("button", { name: "기각" }).click();
    });
    await r1.page.request.post(forged.url, { headers: forged.headers, data: forged.body });
    expect((await reportsOf("guestbook", entryId)).map((r) => r.status)).toEqual(["open"]);
    await a.page.reload();

    // 블라인드 (글)
    await post.locator("summary", { hasText: "블라인드" }).click();
    await expect(post.getByLabel("블라인드 사유")).toHaveValue("신고: 스팸·광고");
    a.page.once("dialog", (d) => d.accept());
    await post.getByRole("button", { name: "가리기" }).click();
    // 처리한 대상은 목록에서 빠진다
    await expect(post).toHaveCount(0);
    const [p] = await sql`select is_public, blind_reason from posts where id = ${postId}`;
    expect([p.is_public, p.blind_reason]).toEqual([false, "신고: 스팸·광고"]);
    expect((await reportsOf("post", postId)).map((r) => [r.status, r.resolved_by])).toEqual([
      ["resolved", a.userId],
      ["resolved", a.userId],
    ]);
    expect(await sql`select detail from admin_audit where action = 'blind_post' and target_id = ${String(postId)}`).toHaveLength(1);

    // 삭제 (댓글): 자리만 남기는 삭제
    a.page.once("dialog", (d) => d.accept());
    await comment.getByRole("button", { name: "삭제" }).click();
    await expect(comment).toHaveCount(0);
    expect((await sql`select deleted_at from comments where id = ${commentId}`)[0].deleted_at).not.toBeNull();
    expect((await reportsOf("comment", commentId)).map((r) => r.status)).toEqual(["resolved"]);
    expect(await sql`select 1 from admin_audit where action = 'delete_comment' and target_id = ${String(commentId)}`).toHaveLength(1);

    // 기각 (방명록): 내용은 그대로
    a.page.once("dialog", (d) => d.accept());
    await guest.getByRole("button", { name: "기각" }).click();
    await expect(guest).toHaveCount(0);
    expect(await sql`select 1 from guestbook_entries where id = ${entryId}`).toHaveLength(1);
    expect((await reportsOf("guestbook", entryId)).map((r) => [r.status, r.resolved_by])).toEqual([["dismissed", a.userId]]);
    const [audit] = await sql`select detail from admin_audit where action = 'dismiss_reports' and target_id = ${String(entryId)}`;
    expect(audit.detail).toBe("신고 1건 기각");

    await a.page.reload();
    for (const key of [`post:${postId}`, `comment:${commentId}`, `guestbook:${entryId}`]) await expect(a.page.locator(`[data-report-group="${key}"]`)).toHaveCount(0);
    await a.page.goto("/admin/audit?action=dismiss_reports");
    await expect(a.page.getByText(`방명록 #${entryId}`, { exact: true })).toBeVisible();
  });

  test("작성자가 먼저 지운 대상은 '이미 지워진'으로 보이고 정리할 수 있다", async ({ browser }) => {
    const author = await member(browser);
    const r1 = await member(browser);
    const a = await admin(browser);
    const postId = await insertPost(author.username, "곧 지울 글");
    await sql`insert into reports (reporter_id, target_type, target_id, reason) values (${r1.userId}, 'post', ${postId}, 'spam')`;
    await sql`delete from posts where id = ${postId}`;
    await a.page.goto("/admin/reports");
    const group = a.page.locator(`[data-report-group="post:${postId}"]`);
    await expect(group).toContainText("이미 지워진 글이에요");
    await group.getByRole("button", { name: "정리" }).click();
    await expect(group).toHaveCount(0);
    expect((await reportsOf("post", postId)).map((r) => r.status)).toEqual(["dismissed"]);
  });
});
