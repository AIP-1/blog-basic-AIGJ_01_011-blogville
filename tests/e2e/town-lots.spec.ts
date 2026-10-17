import { expect, test, type Page } from "./fixtures";
import { signUpOk, sql } from "./helpers";

// 이웃 집 자리 고르기 (TOWN-18), specs/049-town-lots
test.describe.configure({ timeout: 90_000 });

const canvas = (page: Page) => page.locator("[data-town] canvas");
const userId = async (username: string) => (await sql`select id from users where username = ${username}`)[0].id as string;
const short = (name: string) => ([...name].length > 12 ? `${[...name].slice(0, 12).join("")}…` : name);
const panel = (page: Page) => page.locator("[data-town-panel]");
const lotRow = (page: Page, lot: number) => panel(page).locator(`[data-lot="${lot}"]`);
const lotsOf = async (follower: string) =>
  Object.fromEntries(
    (await sql`select u.username, f.town_lot from follows f join users u on u.id = f.followee_id where f.follower_id = ${follower}`).map((r) => [r.username, r.town_lot]),
  );

async function openLots(page: Page) {
  await page.goto("/town");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await page.locator("[data-town-menu]").click();
  await panel(page).getByRole("button", { name: /🏡 이웃 집 자리/ }).click();
  await expect(panel(page)).toHaveAttribute("data-town-panel", "lots");
}

async function neighbors(browser: import("@playwright/test").Browser, n: number) {
  const names: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = await browser.newPage();
    names.push(await signUpOk(p));
    await p.close();
  }
  return names;
}

test.describe("TOWN-18 이웃 집 자리 고르기", () => {
  test("☰ 🏡 이웃 집 자리: 자리마다 사는 이웃, 빈 자리로 옮기면 그 이웃만 가고, 사는 자리를 고르면 맞바꾼다. 마을 집도 그 자리에", async ({ page, browser }) => {
    const me = await signUpOk(page);
    const [a, b, c] = await neighbors(browser, 3);
    const meId = await userId(me);
    await sql`insert into follows (follower_id, followee_id, is_favorite, created_at) values
      (${meId}, ${await userId(a)}, true, now() - interval '3 minutes'),
      (${meId}, ${await userId(b)}, true, now() - interval '2 minutes'),
      (${meId}, ${await userId(c)}, true, now() - interval '1 minute')`;

    await openLots(page);
    await expect(lotRow(page, 1)).toHaveAttribute("data-lot-owner", a);
    await expect(lotRow(page, 2)).toHaveAttribute("data-lot-owner", b);
    await expect(lotRow(page, 3)).toHaveAttribute("data-lot-owner", c);
    await expect(lotRow(page, 4)).toHaveAttribute("data-lot-owner", "");
    await expect(lotRow(page, 4)).toContainText("4번 · 빈 집터");
    await expect(lotRow(page, 1)).toContainText("서쪽 길");
    await expect(lotRow(page, 9)).toContainText("남쪽 들판");

    // 빈 5번 자리로 a를 옮기면 b·c는 그대로
    await panel(page).getByRole("button", { name: "5번 자리 고르기" }).click();
    await expect(panel(page).locator('[data-lot-picker="5"]')).toContainText("5번 자리 · 동쪽 길");
    await expect(panel(page).locator(`[data-lot-choice="${a}"]`)).toContainText("지금 1번 자리 → 이 자리로 옮기기");
    await panel(page).locator(`[data-lot-choice="${a}"]`).click();
    await expect(lotRow(page, 5)).toHaveAttribute("data-lot-owner", a);
    await expect(lotRow(page, 1)).toHaveAttribute("data-lot-owner", "");
    await expect(lotRow(page, 2)).toHaveAttribute("data-lot-owner", b);
    await expect(lotRow(page, 3)).toHaveAttribute("data-lot-owner", c);
    expect(await lotsOf(meId)).toEqual({ [a]: 5, [b]: 2, [c]: 3 });

    // b가 사는 2번을 c에게: 맞바꾸기
    await panel(page).getByRole("button", { name: "2번 자리 고르기" }).click();
    await expect(panel(page).locator(`[data-lot-choice="${b}"]`)).toContainText("지금 이 자리에 살아요");
    await expect(panel(page).locator(`[data-lot-choice="${c}"]`)).toContainText(`지금 3번 자리 → ${b}님과 자리 바꾸기`);
    await panel(page).locator(`[data-lot-choice="${c}"]`).click();
    await expect(lotRow(page, 2)).toHaveAttribute("data-lot-owner", c);
    await expect(lotRow(page, 3)).toHaveAttribute("data-lot-owner", b);
    expect(await lotsOf(meId)).toEqual({ [a]: 5, [b]: 3, [c]: 2 });

    // ✨로 5번 자리 앞에 가면 a의 집
    await panel(page).getByRole("button", { name: "5번 자리로 텔레포트" }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(canvas(page)).toHaveAttribute("data-feet", "1700,420");
    await expect(page.locator("[data-town-prompt]")).toHaveText(`🏠 ${short(a)}의 집 · Space 들어가기`);
    // 다시 열어도 그대로 (텔레포트 목록도 같은 자리)
    await page.reload();
    await expect(canvas(page)).toHaveAttribute("data-ready", "1");
    await page.locator("[data-town-menu]").click();
    await panel(page).getByRole("button", { name: /✨ 텔레포트/ }).click();
    await expect(panel(page).locator('[data-spot="house:5"]')).toContainText(`🏠 ${short(a)}의 집`);
    await expect(panel(page).locator('[data-spot="lot:1"]')).toContainText("빈 집터");
  });

  test("빈 집터 앞 Space면 그 자리 고르기 창, 조작한 값은 거절, ⭐를 끄면 자리가 빈다. 친구 마을·방문자에게는 없다", async ({ page, browser }) => {
    const me = await signUpOk(page);
    const [a, stranger] = await neighbors(browser, 2);
    const meId = await userId(me);
    await sql`insert into follows (follower_id, followee_id, is_favorite) values (${meId}, ${await userId(a)}, true), (${meId}, ${await userId(stranger)}, false)`;

    await page.goto("/town");
    await expect(canvas(page)).toHaveAttribute("data-ready", "1");
    await canvas(page).evaluate((c) => c.dispatchEvent(new CustomEvent("bv-teleport", { detail: { x: 300, y: 1200 } })));
    await expect(page.locator("[data-town-prompt]")).toHaveText("🏡 빈 집터 4번 · Space 이웃 자리 고르기");
    await page.keyboard.press("Space");
    await expect(panel(page).locator('[data-lot-picker="4"]')).toBeVisible();

    // 숨은 칸을 바꿔 보내면 거절 (React 폼은 보낸 뒤 되돌아가 매번 새로 연다)
    const choice = panel(page).locator(`[data-lot-choice="${a}"]`);
    await choice.evaluate((el) => (el.closest("form")!.querySelector<HTMLInputElement>('[name="lot"]')!.value = "11"));
    await choice.click();
    await expect(panel(page).getByRole("alert")).toHaveText("이웃 집 자리는 1~10번이에요.");
    await panel(page).getByRole("button", { name: "‹ 자리 목록" }).click();
    await panel(page).getByRole("button", { name: "4번 자리 고르기" }).click();
    const strangerId = await userId(stranger);
    await choice.evaluate((el, id) => (el.closest("form")!.querySelector<HTMLInputElement>('[name="followeeId"]')!.value = id), strangerId);
    await choice.click();
    await expect(panel(page).getByRole("alert")).toHaveText("⭐ 즐겨찾기한 이웃만 집 자리를 고를 수 있어요.");
    expect(await lotsOf(meId)).toEqual({ [a]: null, [stranger]: null });

    await panel(page).getByRole("button", { name: "‹ 자리 목록" }).click();
    await panel(page).getByRole("button", { name: "4번 자리 고르기" }).click();
    await choice.click();
    await expect(lotRow(page, 4)).toHaveAttribute("data-lot-owner", a);
    expect(await lotsOf(meId)).toEqual({ [a]: 4, [stranger]: null });
    // 마을의 4번 자리에 a의 집
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-town-prompt]")).toHaveText(`🏠 ${short(a)}의 집 · Space 들어가기`);

    // DB도 막는다: 1~10 밖, 즐겨찾기 아닌 이웃, 같은 자리 둘
    await expect(sql`update follows set town_lot = 11 where follower_id = ${meId} and followee_id = ${await userId(a)}`).rejects.toThrow();
    await expect(sql`update follows set town_lot = 5 where follower_id = ${meId} and followee_id = ${strangerId}`).rejects.toThrow();
    await sql`update follows set is_favorite = true where follower_id = ${meId} and followee_id = ${strangerId}`;
    await expect(sql`update follows set town_lot = 4 where follower_id = ${meId} and followee_id = ${strangerId}`).rejects.toThrow();
    await sql`update follows set is_favorite = false where follower_id = ${meId} and followee_id = ${strangerId}`;

    // ⭐를 끄면 자리도 빈다
    await page.reload();
    await expect(canvas(page)).toHaveAttribute("data-ready", "1");
    await page.locator("[data-town-menu]").click();
    await panel(page).getByRole("button", { name: /👫 친구 목록/ }).click();
    await panel(page).getByRole("button", { name: `${a} 즐겨찾기` }).click();
    await expect(panel(page).getByRole("button", { name: `${a} 즐겨찾기` })).toHaveAttribute("aria-pressed", "false");
    expect(await lotsOf(meId)).toEqual({ [a]: null, [stranger]: null });

    // 친구 마을에는 🏡 이웃 집 자리가 없고 빈 집터는 그냥 빈 집터
    await page.goto(`/town/${a}`);
    await expect(canvas(page)).toHaveAttribute("data-ready", "1");
    await page.locator("[data-town-menu]").click();
    await expect(panel(page).getByRole("button", { name: /👫 친구 목록/ })).toBeVisible();
    await expect(panel(page).getByRole("button", { name: /🏡 이웃 집 자리/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await canvas(page).evaluate((c) => c.dispatchEvent(new CustomEvent("bv-teleport", { detail: { x: 300, y: 1200 } })));
    await expect(canvas(page)).toHaveAttribute("data-feet", "300,1200");
    await expect(page.locator("[data-town-prompt]")).toBeHidden();
  });
});

// 이사 올 이웃 (plaza-upgrade-2 B1): 즐겨찾기가 10명보다 적은 내 마을의 빈 자리(뒤쪽부터, 4번 빼고) 3곳에 추천 이웃의 흐린 집
test.describe("B1 이사 올 이웃", () => {
  const suggestedLots = async (page: Page) => {
    await page.locator("[data-town-menu]").click();
    await panel(page).getByRole("button", { name: /🏡 이웃 집 자리/ }).click();
    const lots: number[] = [];
    for (const lot of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) if ((await lotRow(page, lot).textContent())?.includes("이사 올 수 있어요")) lots.push(lot);
    const text = await panel(page).locator("[data-lot]").allTextContents();
    await page.keyboard.press("Escape");
    return { lots, text };
  };

  test("즐겨찾기 0명이면 10·9·8번에 추천 집(4번은 빈 집터), 같은 날 다시 와도 같은 후보. 우체통에서 모시면 그 자리의 이웃이 되고 서 있던 자리는 그대로", async ({ page }) => {
    const me = await signUpOk(page);
    const meId = await userId(me);
    // 가입 직후 환영: 즐겨찾기가 없으면 텔레포트 안내 대신 이사 올 이웃 안내
    await page.goto("/town?welcome=1");
    await expect(canvas(page)).toHaveAttribute("data-ready", "1");
    await expect(page.locator("[data-town-welcome]")).toContainText("이사 올 이웃");
    await expect(page.locator("[data-town-welcome]")).not.toContainText("텔레포트");
    await page.getByRole("button", { name: "환영 닫기" }).click();

    const first = await suggestedLots(page);
    expect(first.lots).toEqual([8, 9, 10]);
    await openLots(page);
    await expect(lotRow(page, 4)).toHaveAttribute("data-lot-owner", "");
    await expect(lotRow(page, 4)).not.toContainText("이사 올");
    // 추천 집 자리도 빈 자리로 친다
    await expect(lotRow(page, 10)).toHaveAttribute("data-lot-owner", "");
    await page.keyboard.press("Escape");
    // 같은 날 다시 로드하면 같은 후보
    await page.reload();
    await expect(canvas(page)).toHaveAttribute("data-ready", "1");
    expect((await suggestedLots(page)).text).toEqual(first.text);

    // 10번 추천 집 우체통 (게임이 우체통 입구에서 보내는 bv-mailbox)
    const before = await canvas(page).getAttribute("data-feet");
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("bv-mailbox", { detail: { lot: 10 } })));
    const box = page.locator('[data-town-panel="mailbox"]');
    await expect(box.getByRole("heading")).toHaveText(/^🏡 .+님이 이사 올 수 있어요$/);
    await expect(box.getByRole("link", { name: "📖 블로그 구경" })).toBeVisible();
    const slug = (await box.locator("[data-mailbox]").getAttribute("data-mailbox"))!;
    await box.getByRole("button", { name: /^⭐ 이웃 맺고 여기 모시기/ }).click();
    await expect(box.getByRole("heading")).toHaveText(/^📮 .+님의 우체통$/);
    await expect(box.locator("[data-mailbox-suggested]")).toHaveCount(0);
    const [row] = await sql`select f.is_favorite, f.town_lot from follows f join blogs b on b.owner_id = f.followee_id where f.follower_id = ${meId} and b.slug = ${slug}`;
    expect(row).toEqual({ is_favorite: true, town_lot: 10 });
    expect(await canvas(page).getAttribute("data-feet")).toBe(before);
    // 새 보상 없음
    expect((await sql`select count(*)::int as n from point_ledger where user_id = ${meId} and reason not in ('signup', 'attendance')`)[0].n).toBe(0);
    await page.keyboard.press("Escape");

    // 새로고침해도 10번은 그 이웃의 집, 나머지 추천은 남은 뒤쪽 자리
    await page.reload();
    await expect(canvas(page)).toHaveAttribute("data-ready", "1");
    const after = await suggestedLots(page);
    expect(after.lots).toEqual([7, 8, 9]);
    await openLots(page);
    await expect(lotRow(page, 10)).not.toHaveAttribute("data-lot-owner", "");

    // 빈 4번 자리 고르기: 즐겨찾는 이웃 1명이 있어도 '새 이웃 모시기'로 오늘의 후보를 모신다
    await panel(page).getByRole("button", { name: "4번 자리 고르기" }).click();
    await panel(page).getByText("🏡 새 이웃 모시기").click();
    const suggest = panel(page).locator("[data-suggest]");
    await expect(suggest).toHaveCount(3);
    const pick = (await suggest.first().getAttribute("data-suggest"))!;
    await suggest.first().getByRole("button", { name: /^모시기/ }).click();
    await expect.poll(async () => (await sql`select f.town_lot from follows f join blogs b on b.owner_id = f.followee_id where f.follower_id = ${meId} and b.slug = ${pick}`)[0]?.town_lot).toBe(4);
    // 다시 그린 창: 4번 자리에 그 이웃이 산다
    await expect(panel(page).locator('[data-lot-picker="4"]').getByText("지금 이 자리에 살아요")).toBeVisible();
  });

  test("즐겨찾기가 10명이면 추천 집이 없다", async ({ page }) => {
    const me = await signUpOk(page);
    const meId = await userId(me);
    // 오래된 블로그 10곳 (함께 도는 다른 시험의 새 회원을 ⭐하면 그 회원 마을의 '나를 ⭐한 회원' 후보가 바뀐다)
    const others = await sql`select b.owner_id from blogs b where b.slug <> 'notice' and b.owner_id <> ${meId} order by b.id limit 10`;
    for (const o of others) await sql`insert into follows (follower_id, followee_id, is_favorite) values (${meId}, ${o.owner_id}, true)`;
    await page.goto("/town");
    await expect(canvas(page)).toHaveAttribute("data-ready", "1");
    expect((await suggestedLots(page)).lots).toEqual([]);
  });
});
