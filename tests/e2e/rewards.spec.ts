import { expect, test, type Browser, type Page } from "@playwright/test";
import { signUpOk, sql, writePost } from "./helpers";

// 경험치·레벨·코인 (GAME-02·03·05·07), specs/031-points-levels
test.describe.configure({ timeout: 90_000 });

const wallet = (page: Page) => page.locator("header [data-wallet]");
const ledger = (username: string, reason: string) =>
  sql`select l.exp_delta, l.coin_delta, l.ref_id from point_ledger l join users u on u.id = l.user_id where u.username = ${username} and l.reason = ${reason} order by l.id`;
const LONG = "가".repeat(120);

async function member(browser: Browser) {
  const page = await browser.newPage();
  const username = await signUpOk(page);
  return { page, username };
}

async function publish(page: Page, body: string, opts: { private?: boolean } = {}) {
  await page.goto("/write");
  await page.getByLabel("제목", { exact: true }).fill("보상 글");
  await page.getByLabel("본문").click();
  await page.keyboard.insertText(body);
  if (opts.private) await page.getByText("🔒 비공개").click();
  await page.getByRole("button", { name: "발행하기" }).click();
  await expect(page).toHaveURL(/\/@[a-z0-9_]+\/\d+(\?new=1)?$/);
  return Number(new URL(page.url()).pathname.split("/").pop());
}

test.describe("GAME-02·03·05 보상", () => {
  test("가입 🪙 100, 글쓰기 안내와 보상(공개·새 글·100자), 고친 글·비공개·상한·어제 기록", async ({ page }) => {
    const username = await signUpOk(page);
    await expect(wallet(page)).toHaveText("Lv.1🪙 110"); // 가입 100 + 1일차 출석 10
    expect(await ledger(username, "signup")).toEqual([{ exp_delta: 0, coin_delta: 100, ref_id: null }]);

    // 글쓰기 아래 안내
    await page.goto("/write");
    const hint = page.locator("[data-reward-hint]");
    await expect(hint).toHaveText(" · 100자 이상 쓰면 보상을 받아요");
    await page.getByLabel("본문").click();
    await page.keyboard.insertText("가".repeat(100));
    await expect(hint).toHaveText(" · 저장하면 ✨ 경험치 30 · 🪙 30 보상 (하루 3번까지)");
    await page.getByText("🔒 비공개").click();
    await expect(hint).toHaveText(" · 비공개 글은 보상이 없어요");

    // 공개 새 글 100자 이상 → 보상, 발행 안내에도
    const first = await publish(page, LONG);
    await expect(page.getByRole("status").filter({ hasText: "글을 발행했어요" })).toHaveText("🎉 글을 발행했어요! ✨ 경험치 30 · 🪙 30 코인을 받았어요");
    await expect(wallet(page)).toHaveText("Lv.2🪙 140"); // 경험치 출석 10 + 글 30
    expect(await ledger(username, "post")).toEqual([{ exp_delta: 30, coin_delta: 30, ref_id: String(first) }]);

    // 고친 글은 보상 없음, 안내도 없음
    await page.goto(`/write/${first}`);
    await expect(page.locator("[data-reward-hint]")).toHaveCount(0);
    await page.getByLabel("제목", { exact: true }).fill("고친 글");
    await page.getByRole("button", { name: "수정 완료" }).click();
    await expect(page).toHaveURL(new RegExp(`/${first}$`));
    expect(await ledger(username, "post")).toHaveLength(1);

    // 비공개 글·짧은 글은 보상 없음
    await publish(page, LONG, { private: true });
    await expect(page.getByRole("status").filter({ hasText: "글을 발행했어요" })).toContainText("보상은 없어요");
    await publish(page, "짧은 글");
    expect(await ledger(username, "post")).toHaveLength(1);

    // 하루 3번까지: 오늘 두 번 더 받으면 네 번째는 없다
    await publish(page, LONG);
    await publish(page, LONG);
    expect(await ledger(username, "post")).toHaveLength(3);
    await publish(page, LONG);
    await expect(page.getByRole("status").filter({ hasText: "글을 발행했어요" })).toContainText("보상 3번을 다 받아서");
    expect(await ledger(username, "post")).toHaveLength(3);
    await expect(wallet(page)).toHaveText("Lv.3🪙 200"); // 경험치 100 → Lv.3

    // 어제 받은 보상은 오늘 상한에 들어가지 않는다 (한국 0시 기준)
    await sql`update point_ledger set created_at = now() - interval '1 day' - interval '1 hour'
      where reason = 'post' and user_id = (select id from users where username = ${username})`;
    await publish(page, LONG);
    expect(await ledger(username, "post")).toHaveLength(4);
  });

  test("남의 글에 쓴 댓글·답글은 하루 10번, 내 글은 없음, 공감 받음은 같은 사람·같은 글 한 번", async ({ browser }) => {
    const owner = await member(browser);
    const guest = await member(browser);
    const postId = await writePost(owner.page, "댓글 보상", "본문");
    const section = (page: Page) => page.locator("#comments");
    const box = (page: Page) => section(page).getByRole("textbox", { name: "댓글", exact: true });
    async function comment(page: Page, text: string) {
      await box(page).fill(text);
      await section(page).getByRole("button", { name: "댓글 등록" }).click();
      await expect(box(page)).toHaveValue("");
    }

    await guest.page.goto(`/@${owner.username}/${postId}`);
    await comment(guest.page, "첫 댓글");
    await expect(wallet(guest.page)).toHaveText("Lv.1🪙 115");
    // 내 글에 단 댓글은 보상 없음
    await owner.page.goto(`/@${owner.username}/${postId}`);
    await comment(owner.page, "주인 댓글");
    expect(await ledger(owner.username, "comment")).toHaveLength(0);

    // 남의 글에 단 답글도 댓글 보상 (ref reply:)
    const parent = section(guest.page).getByRole("listitem").filter({ hasText: "주인 댓글" }).first();
    await guest.page.reload();
    await parent.getByRole("button", { name: "답글" }).click();
    await parent.getByRole("textbox", { name: "답글", exact: true }).fill("손님 답글");
    await parent.getByRole("button", { name: "답글 등록" }).click();
    await expect(parent.getByRole("textbox", { name: "답글", exact: true })).toHaveCount(0);
    await expect(parent.getByRole("list", { name: "답글" }).getByRole("article")).toContainText("손님 답글");
    const rows = await ledger(guest.username, "comment");
    expect(rows.map((r) => r.ref_id?.split(":")[0])).toEqual(["comment", "reply"]);

    // 하루 10번까지: 8번 더 받은 것으로 두면 다음 두 댓글 중 하나만
    await sql`insert into point_ledger (user_id, reason, exp_delta, coin_delta, ref_id)
      select id, 'comment', 5, 5, 'comment:0' from users, generate_series(1, 7) where username = ${guest.username}`;
    await comment(guest.page, "아홉째");
    await comment(guest.page, "열째");
    expect(await ledger(guest.username, "comment")).toHaveLength(10);

    // 공감 받음: 같은 사람이 껐다 켜도 한 번, 내 공감은 없음
    const like = (page: Page) => page.getByRole("button", { name: /공감 \d+$/ });
    await like(guest.page).click();
    await expect(like(guest.page)).toHaveAttribute("aria-pressed", "true");
    await like(guest.page).click();
    await expect(like(guest.page)).toHaveAttribute("aria-pressed", "false");
    await like(guest.page).click();
    await expect(like(guest.page)).toHaveAttribute("aria-pressed", "true");
    await like(owner.page).click();
    await expect(like(owner.page)).toHaveAttribute("aria-pressed", "true");
    expect(await ledger(owner.username, "like_received")).toEqual([
      { exp_delta: 2, coin_delta: 2, ref_id: `${postId}:${(await sql`select id from users where username = ${guest.username}`)[0].id}` },
    ]);
  });
});

test.describe("GAME-07 경험치·코인 내역", () => {
  test("헤더 🪙에서 들어가 요약·이름·시각, 20개씩, 방문자는 첫 화면으로", async ({ page, browser }) => {
    const username = await signUpOk(page);
    await wallet(page).click();
    await expect(page).toHaveURL(/\/wallet$/);
    await expect(page.getByRole("heading", { name: "📒 경험치·코인 내역" })).toBeVisible();
    await expect(page.getByText("기록 2개")).toBeVisible();
    const row = page.locator("[data-ledger=signup]");
    await expect(row).toContainText("🎉 가입 축하");
    await expect(row).toContainText("🪙 +100");
    await expect(row).not.toContainText("✨");
    await expect(row.locator("time")).toHaveText(/^\d{4}\. \d{2}\. \d{2}\. \d{2}:\d{2}$/);

    // 경험치 250 → Lv.5, 50 / 100 (출석 10 + 댓글 100 + 글 140)
    await sql`insert into point_ledger (user_id, reason, exp_delta, coin_delta, ref_id, created_at)
      select id, 'comment', 5, 5, 'comment:' || g, now() - make_interval(mins => g) from users, generate_series(1, 20) g where username = ${username}`;
    await sql`insert into point_ledger (user_id, reason, exp_delta, coin_delta, ref_id)
      select id, 'post', 140, 30, '0' from users where username = ${username}`;
    await page.reload();
    await expect(page.locator("[data-summary=level]")).toHaveText("Lv.5");
    await expect(page.locator("[data-summary=exp]")).toHaveText("✨ 250");
    await expect(page.locator("[data-summary=coin]")).toHaveText("🪙 240");
    await expect(page.locator("[data-progress]")).toHaveText("50 / 100 EXP");
    await expect(wallet(page)).toHaveText("Lv.5🪙 240");
    await expect(page.getByText("기록 23개")).toBeVisible();
    await expect(page.getByRole("list", { name: "기록" }).getByRole("listitem")).toHaveCount(20);
    await expect(page.getByRole("list", { name: "기록" }).getByRole("listitem").first()).toContainText("✏️ 글 작성");
    await page.goto("/wallet?page=2");
    await expect(page.getByRole("list", { name: "기록" }).getByRole("listitem")).toHaveCount(3);
    await expect(page.locator("[data-ledger=comment]")).toHaveCount(3);

    // 375px에서 가로 스크롤 없음
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/wallet");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

    const visitor = await browser.newPage();
    await visitor.goto("/wallet");
    await expect(visitor).toHaveURL(/\/(\?.*)?$/);
  });
});
