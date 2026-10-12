import { expect, test, type Browser, type Page } from "@playwright/test";
import { signUpOk, sql } from "./helpers";

// 이웃 새 글 위 내 이웃 목록과 이웃 취소 (SOC-04 열린 질문의 제안), specs/018-neighbor-list
test.describe.configure({ timeout: 60_000 });

async function member(browser: Browser, viewport?: { width: number; height: number }) {
  const page = viewport ? await (await browser.newContext({ viewport })).newPage() : await browser.newPage();
  const username = await signUpOk(page);
  const [{ id }] = await sql`select id from users where username = ${username}`;
  return { page, username, userId: id as string };
}

/** 다른 시험의 최신 글 목록을 건드리지 않게 아주 옛 날짜로 넣는다 */
async function oldPost(userId: string, title: string, createdAt: string, isPublic = true) {
  await sql`insert into posts (blog_id, title, content_html, content_text, is_public, created_at)
    select b.id, ${title}, '<p>본문</p>', '본문', ${isPublic}, ${createdAt} from blogs b where b.owner_id = ${userId}`;
}

const follow = (followerId: string, followeeId: string) => sql`insert into follows (follower_id, followee_id) values (${followerId}, ${followeeId})`;
const summary = (page: Page) => page.locator("summary").filter({ hasText: "내 이웃" });
const rows = (page: Page) => page.getByRole("list", { name: "내 이웃" }).getByRole("listitem");
const row = (page: Page, username: string) => rows(page).filter({ has: page.getByRole("link", { name: `${username}의 블로그`, exact: true }) });
const followRows = async (followerId: string) =>
  (await sql`select u.username from follows f join users u on u.id = f.followee_id where f.follower_id = ${followerId} order by 1`).map((r) => r.username as string);

test.describe("SOC-04 내 이웃 목록", () => {
  test("접힌 👫 내 이웃 N을 펼치면 최근 공개 글 순으로 블로그 이름·닉네임·글 N·서로 이웃, 이름을 누르면 그 블로그", async ({ browser }) => {
    const me = await member(browser);
    const b = await member(browser);
    const c = await member(browser);
    const d = await member(browser);
    await oldPost(b.userId, "비 글 1", "2001-01-01T00:00:00Z");
    await oldPost(b.userId, "비 글 2", "2001-02-01T00:00:00Z");
    await oldPost(b.userId, "비 비밀 글", "2001-04-01T00:00:00Z", false); // 비공개는 순서·수에 들지 않는다
    await oldPost(c.userId, "씨 글", "2001-03-01T00:00:00Z");
    for (const x of [b, c, d]) await follow(me.userId, x.userId);
    await follow(b.userId, me.userId);

    await me.page.goto("/feed/following");
    await expect(summary(me.page)).toHaveText(/^▸ ?👫 내 이웃 3$/);
    expect((await summary(me.page).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // 지금 탭은 진한 바탕에 흰 글씨 (전에는 .btn 바탕이 이겨 흰 바탕에 흰 글씨였다)
    const current = me.page.getByRole("navigation", { name: "소식 탭" }).getByRole("link", { name: "💛 이웃 새 글" });
    await expect(current).toHaveAttribute("aria-current", "page");
    await expect(current).toHaveCSS("background-color", "rgb(35, 32, 27)");
    await expect(current).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(me.page.getByRole("list", { name: "내 이웃" })).toBeHidden();
    await summary(me.page).click();
    await expect(rows(me.page)).toHaveCount(3);
    await expect(rows(me.page).getByRole("link")).toHaveText([`${c.username}의 블로그`, `${b.username}의 블로그`, `${d.username}의 블로그`]);
    await expect(row(me.page, b.username)).toContainText(`${b.username} · 글 2 서로 이웃`);
    await expect(row(me.page, c.username)).toContainText(`${c.username} · 글 1`);
    await expect(row(me.page, c.username)).not.toContainText("서로 이웃");
    await expect(row(me.page, d.username)).toContainText(`${d.username} · 글 0`);
    const btn = row(me.page, b.username).getByRole("button", { name: "✓ 이웃" });
    await expect(btn).toHaveAccessibleDescription(`${b.username}의 블로그`);
    expect((await btn.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // 이웃 새 글 카드는 그대로 아래에 있다
    await expect(me.page.getByRole("heading", { name: "씨 글" })).toBeVisible();

    await row(me.page, c.username).getByRole("link").click();
    await expect(me.page).toHaveURL(new RegExp(`/@${c.username}$`));
  });

  test("[✓ 이웃]: 확인 창에서 취소하면 그대로, 확인하면 목록·이웃 N·이웃 새 글에서 빠지고 상대 블로그 이웃 수가 준다", async ({ browser }) => {
    const me = await member(browser);
    const b = await member(browser);
    const c = await member(browser);
    await oldPost(b.userId, "비의 남는 글", "2001-01-01T00:00:00Z");
    await oldPost(c.userId, "씨의 빠질 글", "2001-02-01T00:00:00Z");
    await follow(me.userId, b.userId);
    await follow(me.userId, c.userId);

    await me.page.goto("/feed/following");
    await summary(me.page).click();
    const actionPosts: string[] = [];
    me.page.on("request", (r) => {
      if (r.method() === "POST" && r.headers()["next-action"]) actionPosts.push(r.url());
    });
    const messages: string[] = [];
    let accept = false;
    me.page.on("dialog", (dlg) => {
      messages.push(dlg.message());
      if (accept) dlg.accept();
      else dlg.dismiss();
    });
    await row(me.page, c.username).getByRole("button", { name: "✓ 이웃" }).click();
    expect(messages).toEqual(["이웃을 취소할까요?"]);
    await expect(rows(me.page)).toHaveCount(2);
    expect(await followRows(me.userId)).toEqual([b.username, c.username].sort());

    // 키보드로 누르면 지운 뒤 초점이 남은 줄의 [✓ 이웃]으로 간다
    accept = true;
    await row(me.page, c.username).getByRole("button", { name: "✓ 이웃" }).focus();
    await me.page.keyboard.press("Enter");
    await expect(rows(me.page)).toHaveCount(1);
    await expect(row(me.page, b.username).getByRole("button", { name: "✓ 이웃" })).toBeFocused();
    // 확인 창에서 취소한 첫 클릭은 서버에 아무것도 보내지 않았다 (액션은 차례로 처리되니 지금쯤 다 왔다)
    expect(actionPosts).toHaveLength(1);
    await expect(summary(me.page)).toHaveText(/^▸ ?👫 내 이웃 1$/);
    // 펼친 채로 다시 그려진다
    await expect(row(me.page, b.username)).toBeVisible();
    await expect(me.page.getByRole("heading", { name: "씨의 빠질 글" })).toHaveCount(0);
    await expect(me.page.getByRole("heading", { name: "비의 남는 글" })).toBeVisible();
    expect(await followRows(me.userId)).toEqual([b.username]);

    await me.page.goto(`/@${c.username}`);
    await expect(me.page.locator("[data-followers]")).toHaveText("이웃 0");
    await expect(me.page.getByRole("button", { name: "+ 이웃 추가" })).toBeVisible();
  });

  test("이웃이 없으면 안내 문구, 조작한 값은 아무것도 지우지 않는다, 375px에서 긴 블로그 이름에도 가로 스크롤이 없다", async ({ browser }) => {
    const me = await member(browser, { width: 375, height: 800 });
    await me.page.goto("/feed/following");
    await expect(summary(me.page)).toHaveText(/^▸ ?👫 내 이웃 0$/);
    await summary(me.page).click();
    await expect(me.page.getByText("아직 이웃이 없어요. 블로그에서 [+ 이웃 추가]를 눌러 보세요.")).toBeVisible();

    const b = await member(browser);
    const other = await member(browser);
    const x = await member(browser);
    await sql`update blogs set title = ${"아주긴블로그이름".repeat(5)} where owner_id = ${b.userId}`;
    await follow(me.userId, b.userId);
    await follow(other.userId, b.userId);
    await follow(other.userId, x.userId); // 나는 x를 이웃하지 않았다
    await me.page.reload();
    await summary(me.page).click();
    await expect(rows(me.page)).toHaveCount(1);
    expect(await me.page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    expect((await rows(me.page).getByRole("button", { name: "✓ 이웃" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);

    // 65자 값, 다른 회원 ID, 남이 이웃한(나는 이웃하지 않은) 회원 ID로 바꿔 보내도 내 이웃·남의 이웃은 그대로다
    me.page.on("dialog", (dlg) => dlg.accept());
    const input = rows(me.page).locator('input[name="followeeId"]');
    for (const value of ["x".repeat(65), other.userId, x.userId]) {
      await input.evaluate((el, v) => ((el as HTMLInputElement).value = v), value);
      await Promise.all([
        me.page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"]),
        rows(me.page).getByRole("button", { name: "✓ 이웃" }).click(),
      ]);
    }
    expect(await followRows(me.userId)).toEqual([b.username]);
    expect(await followRows(other.userId)).toEqual([b.username, x.username].sort());

    // 자바스크립트가 없으면(화면이 준비되기 전과 같다) 확인 창 없이 지워지지 않는다
    const noJs = await (await browser.newContext({ javaScriptEnabled: false, storageState: await me.page.context().storageState() })).newPage();
    await noJs.goto("/feed/following");
    await summary(noJs).click();
    await rows(noJs).getByRole("button", { name: "✓ 이웃" }).click();
    await noJs.waitForLoadState("load");
    expect(await followRows(me.userId)).toEqual([b.username]);

    // 띄어쓰기 없는 긴 블로그 이름은 블로그 홈 제목에서도 줄을 바꾼다
    await me.page.goto(`/@${b.username}`);
    await expect(me.page.getByRole("heading", { level: 1 })).toHaveText("아주긴블로그이름".repeat(5));
    expect(await me.page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});
