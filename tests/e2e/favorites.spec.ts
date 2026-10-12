import { expect, test, type Browser, type Page } from "@playwright/test";
import { signUpOk, sql } from "./helpers";

// 즐겨찾는 이웃 ⭐ (TOWN-08 · SOC-04, 마을 없이 이웃 새 글의 내 이웃 목록에서), specs/026-favorite-neighbors
test.describe.configure({ timeout: 150_000 });

async function member(browser: Browser) {
  const page = await browser.newPage();
  const username = await signUpOk(page);
  const [{ id }] = await sql`select id from users where username = ${username}`;
  return { page, username, userId: id as string };
}

const follow = (followerId: string, followeeId: string, favorite = false) =>
  sql`insert into follows (follower_id, followee_id, is_favorite) values (${followerId}, ${followeeId}, ${favorite})`;
const summary = (page: Page) => page.locator("summary").filter({ hasText: "내 이웃" });
const rows = (page: Page) => page.getByRole("list", { name: "내 이웃" }).getByRole("listitem");
const row = (page: Page, username: string) => rows(page).filter({ has: page.getByRole("link", { name: `${username}의 블로그`, exact: true }) });
const star = (page: Page, username: string) => row(page, username).getByRole("button", { name: `${username} 즐겨찾기` });
const cardTitles = (page: Page) => page.locator("article h2");
const isFavorite = async (followerId: string, followeeId: string) =>
  (await sql`select is_favorite from follows where follower_id = ${followerId} and followee_id = ${followeeId}`)[0]?.is_favorite as boolean | undefined;

/** 한국 날짜 기준 시각에 글을 넣는다 (`daysAgo`일 전 한국 0시 + `hours`시간). 시험이 끝나면 아주 옛 날짜로 돌린다 */
async function postAt(userId: string, title: string, daysAgo: number, hours: number) {
  const [{ id }] = await sql`insert into posts (blog_id, title, content_html, content_text, is_public, created_at)
    select b.id, ${title}, '<p>본문</p>', '본문', true,
      ((date_trunc('day', now() at time zone 'Asia/Seoul') - make_interval(days => ${daysAgo}) + make_interval(hours => ${hours})) at time zone 'Asia/Seoul')
    from blogs b where b.owner_id = ${userId} returning posts.id`;
  return id as number;
}

/** 폼의 숨은 칸을 바꿔 조작한 요청을 보낸다 (React가 끝난 폼을 되돌리므로 매번 새로 연다) */
async function forge(page: Page, username: string, value: string) {
  await page.goto("/feed/following");
  await summary(page).click();
  await row(page, username)
    .locator("form")
    .filter({ has: page.getByRole("button", { name: `${username} 즐겨찾기` }) })
    .locator('input[name="followeeId"]')
    .evaluate((el, v) => ((el as HTMLInputElement).value = v), value);
  await star(page, username).click();
}

test.describe("TOWN-08 즐겨찾는 이웃", () => {
  test("☆를 누르면 ⭐·목록 맨 위·(1/10), 이웃 새 글은 최근 7일(한국 날짜, 오늘 포함) 즐겨찾기 글이 배지와 함께 맨 위, 끄면 시간 순", async ({ browser }) => {
    const me = await member(browser);
    const b = await member(browser);
    const c = await member(browser);
    await follow(me.userId, b.userId);
    await follow(me.userId, c.userId);
    const ids: number[] = [];
    try {
      ids.push(await postAt(c.userId, "씨 3일 전", 3, 12));
      ids.push(await postAt(c.userId, "씨 10일 전", 10, 12));
      ids.push(await postAt(c.userId, "씨 6일 전 첫 시간", 6, 1)); // 7일 칸의 첫날
      ids.push(await postAt(c.userId, "씨 7일 전 끝 시간", 7, 23)); // 칸 밖
      ids.push(await postAt(b.userId, "비 어제", 1, 12));

      await me.page.goto("/feed/following");
      await expect(cardTitles(me.page)).toHaveText(["비 어제", "씨 3일 전", "씨 6일 전 첫 시간", "씨 7일 전 끝 시간", "씨 10일 전"]);
      await expect(me.page.getByText("⭐ 즐겨찾는 이웃", { exact: true })).toHaveCount(0);

      await summary(me.page).click();
      await expect(me.page.getByText("⭐ 즐겨찾는 이웃의 최근 7일 글이 이웃 새 글 맨 위에 보여요 (0/10)")).toBeVisible();
      // 즐겨찾기가 없으면 최근 공개 글 순 (비가 어제 글로 먼저)
      await expect(rows(me.page).getByRole("link")).toHaveText([`${b.username}의 블로그`, `${c.username}의 블로그`]);
      await expect(star(me.page, c.username)).toHaveText("☆");
      await expect(star(me.page, c.username)).toHaveAttribute("aria-pressed", "false");
      const box = (await star(me.page, c.username).boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);

      await star(me.page, c.username).click();
      await expect(star(me.page, c.username)).toHaveText("⭐");
      await expect(star(me.page, c.username)).toHaveAttribute("aria-pressed", "true");
      await expect(me.page.getByText("(1/10)")).toBeVisible();
      await expect(rows(me.page).getByRole("link")).toHaveText([`${c.username}의 블로그`, `${b.username}의 블로그`]);
      expect(await isFavorite(me.userId, c.userId)).toBe(true);

      await expect(cardTitles(me.page)).toHaveText(["씨 3일 전", "씨 6일 전 첫 시간", "비 어제", "씨 7일 전 끝 시간", "씨 10일 전"]);
      const pinned = me.page.locator("article").filter({ hasText: "⭐ 즐겨찾는 이웃" });
      await expect(pinned.locator("h2")).toHaveText(["씨 3일 전", "씨 6일 전 첫 시간"]);
      await expect(pinned.first().getByText("⭐ 즐겨찾는 이웃", { exact: true })).toHaveCSS("background-color", "rgb(255, 248, 225)");

      // 마을 검색(전체 글)에는 배지가 없다: 즐겨찾기한 회원 본인이 봐도
      await me.page.goto(`/@${me.username}?q=${encodeURIComponent("씨 3일 전")}`);
      await expect(cardTitles(me.page)).toContainText(["씨 3일 전"]);
      await expect(me.page.getByText("⭐ 즐겨찾는 이웃", { exact: true })).toHaveCount(0);

      // 다시 누르면 꺼지고 시간 순으로 돌아간다
      await me.page.goto("/feed/following");
      await summary(me.page).click();
      await star(me.page, c.username).focus();
      await me.page.keyboard.press("Enter");
      await expect(star(me.page, c.username)).toHaveText("☆");
      await expect(me.page.getByText("(0/10)")).toBeVisible();
      // 줄이 아래로 옮겨져도 키보드 초점은 그 별에 남는다
      await expect(rows(me.page).getByRole("link")).toHaveText([`${b.username}의 블로그`, `${c.username}의 블로그`]);
      await expect(star(me.page, c.username)).toBeFocused();
      await expect(cardTitles(me.page)).toHaveText(["비 어제", "씨 3일 전", "씨 6일 전 첫 시간", "씨 7일 전 끝 시간", "씨 10일 전"]);

      // 이웃을 취소하면 즐겨찾기도 풀린다 (다시 이웃 추가해도 ☆)
      await star(me.page, c.username).click();
      await expect(star(me.page, c.username)).toHaveText("⭐");
      me.page.once("dialog", (d) => d.accept());
      await row(me.page, c.username).getByRole("button", { name: "✓ 이웃" }).click();
      await expect(row(me.page, c.username)).toHaveCount(0);
      await follow(me.userId, c.userId);
      expect(await isFavorite(me.userId, c.userId)).toBe(false);
    } finally {
      await sql`update posts set created_at = '2001-01-01' where id = any(${ids})`;
    }
  });

  test("10명이면 11번째 ☆는 안내와 함께 저장되지 않고, 하나를 끄면 된다 / 이웃이 아니거나 이상한 값은 거절", async ({ browser }) => {
    const me = await member(browser);
    const others: { username: string; userId: string }[] = [];
    for (let i = 0; i < 11; i++) {
      const o = await member(browser);
      await o.page.close();
      others.push(o);
      await follow(me.userId, o.userId, i < 10);
    }
    const last = others[10];
    await me.page.goto("/feed/following");
    await summary(me.page).click();
    await expect(me.page.getByText("(10/10)")).toBeVisible();
    // 즐겨찾기 10명이 먼저, 마지막 줄이 ☆
    await expect(rows(me.page).last().getByRole("link")).toHaveText(`${last.username}의 블로그`);
    await star(me.page, last.username).click();
    await expect(row(me.page, last.username).getByRole("alert")).toHaveText("즐겨찾기는 10명까지예요. 다른 이웃의 ⭐를 먼저 꺼 주세요.");
    await expect(star(me.page, last.username)).toHaveText("☆");
    expect(await isFavorite(me.userId, last.userId)).toBe(false);

    await star(me.page, others[0].username).click();
    await expect(me.page.getByText("(9/10)")).toBeVisible();
    // 자리가 생기면 앞의 `10명까지` 문구는 사라진다
    await expect(row(me.page, last.username).getByRole("alert")).toHaveCount(0);
    await star(me.page, last.username).click();
    await expect(me.page.getByText("(10/10)")).toBeVisible();
    expect(await isFavorite(me.userId, last.userId)).toBe(true);
    expect(await isFavorite(me.userId, others[0].userId)).toBe(false);

    // 이웃이 아닌 회원 (조작)
    const stranger = await member(browser);
    await stranger.page.close();
    await forge(me.page, others[0].username, stranger.userId);
    await expect(row(me.page, others[0].username).getByRole("alert")).toHaveText("이웃으로 추가한 사람만 즐겨찾기할 수 있어요.");
    expect(await sql`select 1 from follows where follower_id = ${me.userId} and followee_id = ${stranger.userId}`).toHaveLength(0);
    // 자기 자신
    await forge(me.page, others[0].username, me.userId);
    await expect(row(me.page, others[0].username).getByRole("alert")).toHaveText("이웃으로 추가한 사람만 즐겨찾기할 수 있어요.");
    // 65자
    await forge(me.page, others[0].username, "x".repeat(65));
    await expect(row(me.page, others[0].username).getByRole("alert")).toHaveText("이웃을 찾을 수 없어요.");
    expect(await isFavorite(me.userId, others[0].userId)).toBe(false);
  });
});
