import { expect, test, type Browser, type Locator, type Page } from "./fixtures";
import { signUpOk, sql, writePost } from "./helpers";

// 댓글 수정·비밀 댓글 (SOC-01·02, specs/055-comment-edit-secret)
test.describe.configure({ timeout: 90_000 });

async function member(browser: Browser) {
  const page = await browser.newPage();
  const username = await signUpOk(page);
  return { page, username };
}

const section = (page: Page) => page.locator("#comments");
const box = (page: Page) => section(page).getByRole("textbox", { name: "댓글", exact: true });
const line = (page: Page, text: string): Locator => section(page).getByRole("article").filter({ hasText: text });
const PLACEHOLDER = "🔒 비밀 댓글이에요";

async function comment(page: Page, text: string, secret = false) {
  await box(page).fill(text);
  if (secret) await section(page).getByRole("checkbox", { name: "🔒 비밀 댓글" }).first().check();
  await section(page).getByRole("button", { name: "댓글 등록" }).click();
  await expect(box(page)).toHaveValue("");
}

async function reply(page: Page, parentText: string, text: string, secret = false) {
  const parent = section(page).getByRole("listitem").filter({ hasText: parentText }).first();
  await parent.getByRole("button", { name: "답글", exact: true }).click();
  await parent.getByRole("textbox", { name: "답글", exact: true }).fill(text);
  if (secret) await parent.getByRole("checkbox", { name: "🔒 비밀 댓글" }).check();
  await parent.getByRole("button", { name: "답글 등록" }).click();
  await expect(parent.getByRole("textbox", { name: "답글", exact: true })).toHaveCount(0);
}

/** 그 회원의 쿠키로 받은 HTML (RSC 데이터까지 들어 있다) */
const html = async (page: Page, path: string) => (await page.request.get(path)).text();

test.describe("댓글 수정", () => {
  test("작성자만 [수정], 고치면 (수정됨), 취소·Esc는 그대로, 빈 칸은 문구", async ({ browser }) => {
    const owner = await member(browser);
    const id = await writePost(owner.page, "수정 글", "본문");
    const a = await member(browser);
    await a.page.goto(`/@${owner.username}/${id}`);
    await comment(a.page, "처음 내용");

    const mine = line(a.page, "처음 내용");
    await expect(mine.getByText("(수정됨)")).toHaveCount(0);
    const editButton = mine.getByRole("button", { name: "수정" });
    expect((await editButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    // 취소하면 그대로, 초점은 [수정]으로
    await editButton.click();
    const editBox = section(a.page).getByRole("textbox", { name: "댓글 수정" });
    await expect(editBox).toHaveValue("처음 내용");
    await expect(editBox).toBeFocused();
    await editBox.fill("버릴 내용");
    await section(a.page).getByRole("button", { name: "취소", exact: true }).click();
    await expect(editBox).toHaveCount(0);
    await expect(line(a.page, "처음 내용").getByRole("button", { name: "수정" })).toBeFocused();

    // 키보드: Enter로 열고 Esc로 닫는다
    await a.page.keyboard.press("Enter");
    await expect(editBox).toBeFocused();
    await a.page.keyboard.press("Escape");
    await expect(editBox).toHaveCount(0);

    // 빈 칸은 문구, 쓴 내용은 남는다
    await line(a.page, "처음 내용").getByRole("button", { name: "수정" }).click();
    await editBox.fill("   ");
    await section(a.page).getByRole("button", { name: "저장" }).click();
    await expect(section(a.page).getByRole("alert")).toHaveText("댓글을 적어 주세요");
    await expect(editBox).toHaveValue("   ");

    await editBox.fill("고친 내용");
    await section(a.page).getByRole("button", { name: "저장" }).click();
    await expect(editBox).toHaveCount(0);
    await expect(line(a.page, "고친 내용").getByText("(수정됨)")).toBeVisible();
    const [row] = await sql`select content, edited_at from comments where post_id = ${id}`;
    expect(row.content).toBe("고친 내용");
    expect(row.edited_at).not.toBeNull();

    // 블로그 주인·다른 회원에게는 [수정]이 없다 (주인은 [삭제]만)
    await owner.page.goto(`/@${owner.username}/${id}`);
    await expect(line(owner.page, "고친 내용").getByText("(수정됨)")).toBeVisible();
    await expect(line(owner.page, "고친 내용").getByRole("button", { name: "수정" })).toHaveCount(0);
    await expect(line(owner.page, "고친 내용").getByRole("button", { name: "삭제" })).toHaveCount(1);
    const b = await member(browser);
    await b.page.goto(`/@${owner.username}/${id}`);
    await expect(line(b.page, "고친 내용").getByRole("button", { name: "수정" })).toHaveCount(0);

    // 답글도 작성자가 고친다
    await reply(b.page, "고친 내용", "B의 답글");
    await line(b.page, "B의 답글").getByRole("button", { name: "수정" }).click();
    await section(b.page).getByRole("textbox", { name: "댓글 수정" }).fill("B의 고친 답글");
    await section(b.page).getByRole("button", { name: "저장" }).click();
    await expect(line(b.page, "B의 고친 답글").getByText("(수정됨)")).toBeVisible();
    await a.page.reload();
    await expect(line(a.page, "B의 고친 답글").getByRole("button", { name: "수정" })).toHaveCount(0);
  });

  test("남의 댓글 ID로 바꾼 수정 요청은 거절되고 DB는 그대로 (블로그 주인도)", async ({ browser }) => {
    const owner = await member(browser);
    const id = await writePost(owner.page, "조작 글", "본문");
    const a = await member(browser);
    await a.page.goto(`/@${owner.username}/${id}`);
    await comment(a.page, "A의 원래 댓글");
    const [{ id: aComment }] = await sql`select id from comments where post_id = ${id}`;
    await reply(a.page, "A의 원래 댓글", "A의 원래 답글");
    const [{ id: aReply }] = await sql`select id from replies where comment_id = ${aComment}`;

    const forge = async (page: Page, ownText: string, targetId: number) => {
      await page.route("**/*", async (route) => {
        const req = route.request();
        if (req.method() === "POST" && req.headers()["next-action"]) {
          return route.continue({ postData: req.postData()!.replace(/(name="_\d+_id"\r\n\r\n)\d+/, `$1${targetId}`) });
        }
        return route.continue();
      });
      await line(page, ownText).getByRole("button", { name: "수정" }).click();
      await section(page).getByRole("textbox", { name: "댓글 수정" }).fill("조작한 내용");
      await section(page).getByRole("button", { name: "저장" }).click();
      await expect(section(page).getByRole("alert")).toHaveText("수정할 수 있는 댓글이 없어요");
      await page.unroute("**/*");
      await section(page).getByRole("button", { name: "취소", exact: true }).click();
    };

    const b = await member(browser);
    await b.page.goto(`/@${owner.username}/${id}`);
    await comment(b.page, "B 댓글");
    await forge(b.page, "B 댓글", aComment);
    await reply(b.page, "B 댓글", "B 답글");
    await forge(b.page, "B 답글", aReply);

    // 블로그 주인도 남의 댓글은 고치지 못한다
    await owner.page.goto(`/@${owner.username}/${id}`);
    await comment(owner.page, "주인 댓글");
    await forge(owner.page, "주인 댓글", aComment);

    const [c] = await sql`select content, edited_at from comments where id = ${aComment}`;
    expect(c.content).toBe("A의 원래 댓글");
    expect(c.edited_at).toBeNull();
    const [r] = await sql`select content, edited_at from replies where id = ${aReply}`;
    expect(r.content).toBe("A의 원래 답글");
    expect(r.edited_at).toBeNull();
    // 지운 댓글에는 [수정]이 없다
    await sql`update comments set deleted_at = now(), content = '' where id = ${aComment}`;
    await a.page.reload();
    await expect(section(a.page).getByText("삭제된 댓글이에요")).toBeVisible();
    await expect(line(a.page, "삭제된 댓글이에요").getByRole("button", { name: "수정" })).toHaveCount(0);
  });
});

test.describe("비밀 댓글", () => {
  test("작성자·주인·관리자만 내용을 보고, 다른 회원·방문자는 문구만 (HTML에도 없음)", async ({ browser }) => {
    const owner = await member(browser);
    const id = await writePost(owner.page, "비밀 글", "본문");
    const path = `/@${owner.username}/${id}`;
    const a = await member(browser);
    await a.page.goto(path);
    await comment(a.page, "A만 아는 비밀 이야기", true);
    const [{ is_secret }] = await sql`select is_secret from comments where post_id = ${id}`;
    expect(is_secret).toBe(true);

    await expect(line(a.page, "A만 아는 비밀 이야기").getByLabel("비밀 댓글")).toBeVisible();
    await owner.page.goto(path);
    await expect(line(owner.page, "A만 아는 비밀 이야기")).toBeVisible();

    const admin = await member(browser);
    await sql`update users set role = 'admin' where username = ${admin.username}`;
    await admin.page.goto(path);
    await expect(line(admin.page, "A만 아는 비밀 이야기")).toBeVisible();

    const c = await member(browser);
    await c.page.goto(path);
    await expect(section(c.page).getByText(PLACEHOLDER)).toBeVisible();
    // 볼 수 없는 비밀 댓글에는 [답글]·[수정]·[삭제]가 없다
    await expect(line(c.page, PLACEHOLDER).getByRole("button")).toHaveCount(0);
    expect(await html(c.page, path)).not.toContain("A만 아는 비밀 이야기");

    const visitor = await browser.newPage();
    await visitor.goto(path);
    await expect(section(visitor).getByText(PLACEHOLDER)).toBeVisible();
    expect(await html(visitor, path)).not.toContain("A만 아는 비밀 이야기");

    // 💬 N은 비밀 댓글도 센다
    await expect(section(visitor).getByRole("heading", { level: 2 })).toHaveText("💬 댓글 1");

    // 수정으로 비밀을 끄면 모두 본다. 내용이 그대로면 (수정됨)은 없다
    await a.page.reload();
    await line(a.page, "A만 아는 비밀 이야기").getByRole("button", { name: "수정" }).click();
    const checkbox = section(a.page).getByRole("checkbox", { name: "🔒 비밀 댓글" }).first();
    await expect(checkbox).toBeChecked();
    expect((await section(a.page).locator("label", { hasText: "🔒 비밀 댓글" }).first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await checkbox.uncheck();
    await section(a.page).getByRole("button", { name: "저장" }).click();
    await expect(section(a.page).getByRole("textbox", { name: "댓글 수정" })).toHaveCount(0);
    await c.page.reload();
    await expect(line(c.page, "A만 아는 비밀 이야기")).toBeVisible();
    await expect(line(c.page, "A만 아는 비밀 이야기").getByText("(수정됨)")).toHaveCount(0);
  });

  test("답글: 비밀 댓글 밑 답글과 비밀 답글은 원댓글 작성자·답글 작성자·주인만", async ({ browser }) => {
    const owner = await member(browser);
    const id = await writePost(owner.page, "답글 비밀 글", "본문");
    const path = `/@${owner.username}/${id}`;
    const a = await member(browser);
    const c = await member(browser);
    const d = await member(browser);

    // A의 비밀 댓글에 주인이 (비밀 아닌) 답글
    await a.page.goto(path);
    await comment(a.page, "A의 비밀 댓글", true);
    await owner.page.goto(path);
    await reply(owner.page, "A의 비밀 댓글", "주인의 답글 내용");

    // C의 공개 댓글에 A가 비밀 답글
    await c.page.goto(path);
    await comment(c.page, "C의 공개 댓글");
    await a.page.reload();
    await reply(a.page, "C의 공개 댓글", "A의 비밀 답글 내용", true);

    // A(원댓글 작성자)·주인은 다 본다
    for (const p of [a.page, owner.page]) {
      await p.reload();
      await expect(line(p, "주인의 답글 내용")).toBeVisible();
      await expect(line(p, "A의 비밀 답글 내용")).toBeVisible();
    }
    // C: A의 비밀 댓글·그 밑 답글은 문구만, 자기 댓글 밑 비밀 답글은 본다
    await c.page.reload();
    await expect(line(c.page, "A의 비밀 답글 내용")).toBeVisible();
    await expect(section(c.page).getByText(PLACEHOLDER)).toHaveCount(2);
    const cHtml = await html(c.page, path);
    expect(cHtml).not.toContain("A의 비밀 댓글");
    expect(cHtml).not.toContain("주인의 답글 내용");
    // D: 셋 다 문구만
    await d.page.goto(path);
    await expect(line(d.page, "C의 공개 댓글")).toBeVisible();
    await expect(section(d.page).getByText(PLACEHOLDER)).toHaveCount(3);
    const dHtml = await html(d.page, path);
    for (const secret of ["A의 비밀 댓글", "주인의 답글 내용", "A의 비밀 답글 내용"]) expect(dHtml).not.toContain(secret);

    // 볼 수 없는 비밀 댓글에 답글을 다는 요청: C 댓글의 [답글]을 A의 비밀 댓글 ID로 바꾼다
    const [{ id: secretId }] = await sql`select id from comments where post_id = ${id} and is_secret`;
    await d.page.route("**/*", async (route) => {
      const req = route.request();
      if (req.method() === "POST" && req.headers()["next-action"]) {
        return route.continue({ postData: req.postData()!.replace(/(name="_\d+_commentId"\r\n\r\n)\d+/, `$1${secretId}`) });
      }
      return route.continue();
    });
    const parent = section(d.page).getByRole("listitem").filter({ hasText: "C의 공개 댓글" }).first();
    await parent.getByRole("button", { name: "답글", exact: true }).click();
    await parent.getByRole("textbox", { name: "답글", exact: true }).fill("몰래 답글");
    await parent.getByRole("button", { name: "답글 등록" }).click();
    await expect(parent.getByRole("alert")).toHaveText("답글을 달 댓글이 없어요");
    expect(await sql`select 1 from replies where content = '몰래 답글'`).toHaveLength(0);
  });

  test("블로그 옆 칸 최근 댓글: 볼 수 없는 사람에게는 문구만, 주인·작성자는 내용", async ({ browser }) => {
    const owner = await member(browser);
    const id = await writePost(owner.page, "옆 칸 글", "본문");
    const a = await member(browser);
    await a.page.goto(`/@${owner.username}/${id}`);
    await comment(a.page, "옆칸에 새면 안 되는 말", true);
    await reply(a.page, "옆칸에 새면 안 되는 말", "비밀 밑 답글 내용");

    const home = `/@${owner.username}`;
    const widget = (page: Page) => page.getByRole("complementary", { name: "옆 칸" }).getByRole("region", { name: "💬 최근 댓글" });

    const visitor = await browser.newPage();
    await visitor.goto(home);
    await expect(widget(visitor).getByText(PLACEHOLDER)).toHaveCount(2);
    const visitorHtml = await html(visitor, home);
    expect(visitorHtml).not.toContain("옆칸에 새면 안 되는 말");
    expect(visitorHtml).not.toContain("비밀 밑 답글 내용");

    const c = await member(browser);
    await c.page.goto(home);
    await expect(widget(c.page).getByText(PLACEHOLDER)).toHaveCount(2);
    expect(await html(c.page, home)).not.toContain("옆칸에 새면 안 되는 말");

    for (const p of [owner.page, a.page]) {
      await p.goto(home);
      await expect(widget(p)).toContainText("옆칸에 새면 안 되는 말");
      await expect(widget(p)).toContainText("비밀 밑 답글 내용");
    }
  });
});
