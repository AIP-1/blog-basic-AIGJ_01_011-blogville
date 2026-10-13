import { expect, test, type Browser, type Locator, type Page } from "./fixtures";
import { signUpOk, sql } from "./helpers";

// 방명록 (BLOG-10, specs/056-guestbook)
test.describe.configure({ timeout: 90_000 });

async function member(browser: Browser) {
  const page = await browser.newPage();
  const username = await signUpOk(page);
  const [{ id, nickname }] = await sql`select u.id, p.nickname from users u join profiles p on p.user_id = u.id where u.username = ${username}`;
  return { page, username, userId: id as string, nickname: nickname as string };
}

const path = (slug: string) => `/@${slug}/guestbook`;
const box = (page: Page) => page.getByRole("textbox", { name: "방명록", exact: true });
const entry = (page: Page, text: string): Locator => page.getByRole("list", { name: "방명록 글" }).getByRole("article").filter({ hasText: text });
const PLACEHOLDER = "🔒 비밀 방명록이에요";

async function write(page: Page, text: string, secret = false) {
  await box(page).fill(text);
  if (secret) await page.getByRole("checkbox", { name: "🔒 비밀글" }).check();
  await page.getByRole("button", { name: "방명록 남기기" }).click();
  await expect(box(page)).toHaveValue("");
  await expect(entry(page, text)).toBeVisible();
}

async function reply(page: Page, entryText: string, text: string) {
  const e = entry(page, entryText);
  await e.getByRole("button", { name: "답글", exact: true }).click();
  await e.getByRole("textbox", { name: "방명록 답글" }).fill(text);
  await e.getByRole("button", { name: "답글 등록" }).click();
  await expect(e.getByRole("textbox", { name: "방명록 답글" })).toHaveCount(0);
  await expect(e.getByLabel("주인 답글").getByText(text)).toBeVisible();
}

/** 그 회원의 쿠키로 받은 HTML (RSC 데이터까지 들어 있다) */
const html = async (page: Page, url: string) => (await page.request.get(url)).text();

/** 다음 Server Action 요청의 폼 값 `name`을 `value`로 바꿔 보낸다 */
async function forgeNext(page: Page, name: string, value: string | number) {
  await page.route("**/*", async (route) => {
    const req = route.request();
    if (req.method() === "POST" && req.headers()["next-action"]) {
      return route.continue({ postData: req.postData()!.replace(new RegExp(`(name="_\\d+_${name}"\\r\\n\\r\\n)[^\\r]+`), `$1${value}`) });
    }
    return route.continue();
  });
}

test.describe("BLOG-10 방명록", () => {
  test("쓰면 맨 위에 나오고, 작성자만 고쳐 (수정됨), 옆 칸·주인 도구에서 들어오며 수가 보인다", async ({ browser }) => {
    const owner = await member(browser);
    const a = await member(browser);
    // 옆 칸 맨 위의 📖 방명록으로 들어온다
    await a.page.goto(`/@${owner.username}`);
    const sideLink = a.page.locator("[data-guestbook-link]");
    await expect(sideLink).toHaveText(/방명록\s*0/);
    await sideLink.click();
    await expect(a.page).toHaveURL(new RegExp(`/@${owner.username}/guestbook$`));
    await expect(a.page.getByRole("heading", { level: 1 })).toHaveText("📖 방명록 0");
    await expect(a.page.getByText("아직 방명록이 없어요")).toBeVisible();

    // 빈 칸은 댓글과 같은 문구, 쓴 내용은 남는다
    await box(a.page).fill("   ");
    await a.page.getByRole("button", { name: "방명록 남기기" }).click();
    await expect(a.page.locator("main").getByRole("alert")).toHaveText("댓글을 적어 주세요");

    await write(a.page, "첫 번째 인사");
    await write(a.page, "두 번째 인사\n<b>굵게</b>");
    await expect(a.page.getByRole("heading", { level: 1 })).toHaveText("📖 방명록 2");
    // 최신순, HTML은 글자 그대로
    await expect(a.page.getByRole("list", { name: "방명록 글" }).getByRole("article").first()).toContainText("두 번째 인사");
    await expect(entry(a.page, "두 번째 인사").getByText("<b>굵게</b>")).toBeVisible();

    // 작성자 수정 → (수정됨)
    await entry(a.page, "첫 번째 인사").getByRole("button", { name: "수정" }).click();
    const editBox = a.page.getByRole("textbox", { name: "방명록 수정" });
    await expect(editBox).toBeFocused();
    await editBox.fill("고친 인사");
    await a.page.getByRole("button", { name: "저장" }).click();
    await expect(editBox).toHaveCount(0);
    await expect(entry(a.page, "고친 인사").getByText("(수정됨)")).toBeVisible();
    const [row] = await sql`select content, edited_at from guestbook_entries where author_id = ${a.userId} order by id limit 1`;
    expect(row.content).toBe("고친 인사");
    expect(row.edited_at).not.toBeNull();

    // 주인에게는 [수정]이 없고 [삭제]·[답글]이 있다. 주인 도구 막대에 수가 보인다
    await owner.page.goto(`/@${owner.username}`);
    await expect(owner.page.getByRole("navigation", { name: "주인 도구" }).getByRole("link", { name: "📖 방명록 2" })).toBeVisible();
    await owner.page.goto(path(owner.username));
    await expect(entry(owner.page, "고친 인사").getByRole("button", { name: "수정" })).toHaveCount(0);
    await expect(entry(owner.page, "고친 인사").getByRole("button", { name: "삭제" })).toHaveCount(1);
    await expect(entry(owner.page, "고친 인사").getByRole("button", { name: "답글", exact: true })).toHaveCount(1);

    // 10개씩 쪽 나눔
    const [{ id: blogId }] = await sql`select id from blogs where slug = ${owner.username}`;
    for (let i = 1; i <= 9; i++) await sql`insert into guestbook_entries (blog_id, author_id, content, created_at) values (${blogId}, ${a.userId}, ${"옛 인사 " + i}, now() - make_interval(days => ${i}))`;
    await a.page.goto(path(owner.username));
    await expect(a.page.getByRole("list", { name: "방명록 글" }).getByRole("article")).toHaveCount(10);
    await a.page.getByRole("navigation", { name: "페이지" }).getByRole("link", { name: "2" }).click();
    await expect(a.page).toHaveURL(/\?page=2$/);
    await expect(a.page.getByRole("list", { name: "방명록 글" }).getByRole("article")).toHaveCount(1);
    await expect(entry(a.page, "옛 인사 9")).toBeVisible();
  });

  test("비밀글은 작성자·주인·관리자만 보고, 다른 회원·방문자는 문구만 (HTML에도 없음), 주인 답글도 같다", async ({ browser }) => {
    const owner = await member(browser);
    const a = await member(browser);
    await a.page.goto(path(owner.username));
    await write(a.page, "A만 아는 비밀 인사", true);
    await expect(entry(a.page, "A만 아는 비밀 인사").getByLabel("비밀글")).toBeVisible();

    await owner.page.goto(path(owner.username));
    await reply(owner.page, "A만 아는 비밀 인사", "주인의 비밀 답장");

    const admin = await member(browser);
    await sql`update users set role = 'admin' where username = ${admin.username}`;
    await admin.page.goto(path(owner.username));
    await expect(entry(admin.page, "A만 아는 비밀 인사")).toContainText("주인의 비밀 답장");

    await a.page.reload();
    await expect(entry(a.page, "A만 아는 비밀 인사")).toContainText("주인의 비밀 답장");

    const c = await member(browser);
    await c.page.goto(path(owner.username));
    const hidden = entry(c.page, PLACEHOLDER);
    await expect(hidden.first()).toBeVisible();
    await expect(hidden.getByRole("button")).toHaveCount(0);
    const cHtml = await html(c.page, path(owner.username));
    expect(cHtml).not.toContain("A만 아는 비밀 인사");
    expect(cHtml).not.toContain("주인의 비밀 답장");

    const visitor = await browser.newPage();
    await visitor.goto(path(owner.username));
    await expect(entry(visitor, PLACEHOLDER).first()).toBeVisible();
    const vHtml = await html(visitor, path(owner.username));
    expect(vHtml).not.toContain("A만 아는 비밀 인사");
    expect(vHtml).not.toContain("주인의 비밀 답장");
    // 비밀글도 센다
    await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("📖 방명록 1");
  });

  test("주인 답글: 작성자에게 알림, 주인은 새 글 알림을 받고 누르면 방명록으로, 답글 수정·삭제", async ({ browser }) => {
    const owner = await member(browser);
    const a = await member(browser);
    // 주인이 자기 방명록에 쓴 글은 알림이 없다
    await owner.page.goto(path(owner.username));
    await write(owner.page, "주인이 쓴 인사");
    await a.page.goto(path(owner.username));
    await write(a.page, "안녕하세요 놀러 왔어요");

    const kinds = async (userId: string) =>
      (await sql`select kind, actor_id from notifications where user_id = ${userId} and kind like 'guestbook%' order by id`).map((r) => `${r.kind}:${r.actor_id}`);
    expect(await kinds(owner.userId)).toEqual([`guestbook:${a.userId}`]);

    await owner.page.goto("/notifications");
    const ownerRow = owner.page.getByRole("button", { name: `📖 ${a.nickname}님이 방명록에 글을 남겼어요` });
    await expect(ownerRow).toBeVisible();
    await ownerRow.click();
    await expect(owner.page).toHaveURL(new RegExp(`/@${owner.username}/guestbook$`));

    await reply(owner.page, "안녕하세요 놀러 왔어요", "반가워요!");
    expect(await kinds(a.userId)).toEqual([`guestbook_reply:${owner.userId}`]);
    await a.page.goto("/notifications");
    await expect(a.page.getByRole("button", { name: `📖 ${owner.nickname}님이 내 방명록 글에 답글을 달았어요` })).toBeVisible();

    // 작성자에게는 답글 버튼이 없다
    await a.page.goto(path(owner.username));
    const aEntry = entry(a.page, "안녕하세요 놀러 왔어요");
    await expect(aEntry.getByLabel("주인 답글")).toContainText("반가워요!");
    await expect(aEntry.getByRole("button", { name: /답글/ })).toHaveCount(0);

    // 답글 수정 → (수정됨), 다시 알림은 없다
    const oEntry = entry(owner.page, "안녕하세요 놀러 왔어요");
    await oEntry.getByRole("button", { name: "답글 수정" }).click();
    await oEntry.getByRole("textbox", { name: "방명록 답글" }).fill("정말 반가워요!");
    await oEntry.getByRole("button", { name: "저장" }).click();
    await expect(oEntry.getByRole("textbox", { name: "방명록 답글" })).toHaveCount(0);
    await expect(oEntry.getByLabel("주인 답글")).toContainText("정말 반가워요!");
    await expect(oEntry.getByLabel("주인 답글").getByText("(수정됨)")).toBeVisible();
    expect(await kinds(a.userId)).toHaveLength(1);

    // 답글 삭제
    owner.page.once("dialog", (d) => d.accept());
    await oEntry.getByRole("button", { name: "답글 삭제" }).click();
    await expect(oEntry.getByLabel("주인 답글")).toHaveCount(0);
    const [row] = await sql`select reply, replied_at from guestbook_entries where author_id = ${a.userId}`;
    expect(row.reply).toBeNull();
    expect(row.replied_at).toBeNull();
  });

  test("삭제: 작성자와 주인, 취소하면 그대로. 지우면 알림도 사라지고 탈퇴하면 그 회원의 글이 지워진다", async ({ browser }) => {
    const owner = await member(browser);
    const a = await member(browser);
    await a.page.goto(path(owner.username));
    await write(a.page, "A가 지울 인사");
    await write(a.page, "주인이 지울 인사");
    await write(a.page, "탈퇴로 지워질 인사");

    a.page.once("dialog", (d) => d.dismiss());
    await entry(a.page, "A가 지울 인사").getByRole("button", { name: "삭제" }).click();
    await expect(entry(a.page, "A가 지울 인사")).toBeVisible();
    a.page.once("dialog", (d) => d.accept());
    await entry(a.page, "A가 지울 인사").getByRole("button", { name: "삭제" }).click();
    await expect(entry(a.page, "A가 지울 인사")).toHaveCount(0);

    await owner.page.goto(path(owner.username));
    owner.page.once("dialog", (d) => d.accept());
    await entry(owner.page, "주인이 지울 인사").getByRole("button", { name: "삭제" }).click();
    await expect(entry(owner.page, "주인이 지울 인사")).toHaveCount(0);

    const left = await sql`select content from guestbook_entries where author_id = ${a.userId}`;
    expect(left.map((r) => r.content)).toEqual(["탈퇴로 지워질 인사"]);
    expect(await sql`select 1 from notifications where user_id = ${owner.userId} and kind = 'guestbook'`).toHaveLength(1);

    await sql`delete from users where id = ${a.userId}`;
    expect(await sql`select 1 from guestbook_entries where author_id = ${a.userId}`).toHaveLength(0);
    await owner.page.reload();
    await expect(owner.page.getByRole("heading", { level: 1 })).toHaveText("📖 방명록 0");
  });

  test("조작한 요청(남의 글 수정·삭제, 주인이 아닌 답글, 이상한 블로그)은 거절되고 DB는 그대로", async ({ browser }) => {
    const owner = await member(browser);
    const a = await member(browser);
    await a.page.goto(path(owner.username));
    await write(a.page, "A의 원래 인사");
    const [{ id: target }] = await sql`select id from guestbook_entries where author_id = ${a.userId}`;

    // B는 주인의 방명록에서 자기 글의 [수정]·[삭제] 요청을 A의 글 ID로 바꾼다
    const b = await member(browser);
    await b.page.goto(path(owner.username));
    await write(b.page, "B 인사");
    await forgeNext(b.page, "id", target);
    await entry(b.page, "B 인사").getByRole("button", { name: "수정" }).click();
    await b.page.getByRole("textbox", { name: "방명록 수정" }).fill("조작한 내용");
    await b.page.getByRole("button", { name: "저장" }).click();
    await expect(b.page.locator("main").getByRole("alert")).toHaveText("수정할 수 있는 방명록 글이 없어요");
    await b.page.getByRole("button", { name: "취소", exact: true }).click();

    b.page.once("dialog", (d) => d.accept());
    const res = b.page.waitForResponse((r) => r.request().method() === "POST");
    await entry(b.page, "B 인사").getByRole("button", { name: "삭제" }).click();
    expect((await res).status()).toBe(200);
    await b.page.unroute("**/*");

    // B는 자기 블로그의 방명록 글에 다는 답글을 A의 글(남의 블로그) ID로 바꾼다
    await a.page.goto(path(b.username));
    await write(a.page, "B 블로그에 쓴 인사");
    await b.page.goto(path(b.username));
    await forgeNext(b.page, "id", target);
    const bEntry = entry(b.page, "B 블로그에 쓴 인사");
    await bEntry.getByRole("button", { name: "답글", exact: true }).click();
    await bEntry.getByRole("textbox", { name: "방명록 답글" }).fill("조작한 답글");
    await bEntry.getByRole("button", { name: "답글 등록" }).click();
    await expect(bEntry.getByRole("alert")).toHaveText("답글을 달 방명록 글이 없어요");
    await b.page.unroute("**/*");

    // 이상한 블로그 ID로 쓰기
    await b.page.goto(path(owner.username));
    await forgeNext(b.page, "blogId", "2147483647");
    await box(b.page).fill("없는 블로그");
    await b.page.getByRole("button", { name: "방명록 남기기" }).click();
    await expect(b.page.locator("main").getByRole("alert")).toHaveText("블로그를 찾을 수 없어요");
    await b.page.unroute("**/*");
    await forgeNext(b.page, "blogId", "abc");
    await b.page.getByRole("button", { name: "방명록 남기기" }).click();
    await expect(b.page.locator("main").getByRole("alert")).toHaveText("잘못된 요청이에요");
    await b.page.unroute("**/*");

    const [row] = await sql`select content, edited_at, reply from guestbook_entries where id = ${target}`;
    expect(row.content).toBe("A의 원래 인사");
    expect(row.edited_at).toBeNull();
    expect(row.reply).toBeNull();
    // B의 글도 그대로 (조작한 삭제가 B 글을 지우지도 않는다)
    expect(await sql`select 1 from guestbook_entries where author_id = ${b.userId}`).toHaveLength(1);
    expect(await sql`select 1 from guestbook_entries where content = '없는 블로그'`).toHaveLength(0);
    expect(await sql`select 1 from notifications where user_id = ${a.userId} and kind = 'guestbook_reply'`).toHaveLength(0);
  });

  test("방문자는 로그인 링크(돌아올 주소 포함), 375px에서 가로 스크롤 없고 버튼 44px 이상", async ({ browser }) => {
    const owner = await member(browser);
    const a = await member(browser);
    await a.page.goto(path(owner.username));
    await write(a.page, "아주 긴 인사 ".repeat(60));
    await owner.page.goto(path(owner.username));
    await reply(owner.page, "아주 긴 인사", "긴답글".repeat(100));

    const visitor = await browser.newPage();
    await visitor.goto(path(owner.username));
    await expect(box(visitor)).toHaveCount(0);
    const login = visitor.getByRole("link", { name: "로그인", exact: true }).last();
    await expect(login).toHaveAttribute("href", `/?next=${encodeURIComponent(path(owner.username))}`);

    for (const page of [owner.page, visitor]) {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.reload();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    }
    for (const b of await owner.page.locator("main").getByRole("button").all()) {
      if (await b.isVisible()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect((await owner.page.locator("label", { hasText: "🔒 비밀글" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
});
