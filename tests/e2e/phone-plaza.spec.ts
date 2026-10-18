import { expect, test } from "./fixtures";
import { insertPosts, signUpOk, sql } from "./helpers";

// 휴대폰 광장 줄등·집 링크·이웃 띠 (plaza-upgrade-2 C5), 390×844
test.describe.configure({ timeout: 120_000 });
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const userId = async (username: string) => (await sql`select id from users where username = ${username}`)[0].id as string;

test.describe("휴대폰 광장 (C5)", () => {
  test("줄등 초롱(글 쓴 집만 켜짐), 집 링크는 /@주소, 이웃 띠는 이웃 수만큼, 띠를 누르면 최근 글 3편 시트", async ({ page, browser }) => {
    const me = await signUpOk(page);
    const neighbors: string[] = [];
    for (let i = 0; i < 4; i++) {
      const other = await browser.newPage();
      neighbors.push(await signUpOk(other));
      await other.close();
    }
    for (const [i, n] of neighbors.entries())
      await sql`insert into follows (follower_id, followee_id, is_favorite, created_at) values (${await userId(me)}, ${await userId(n)}, true, now() - make_interval(mins => ${10 - i}))`;
    // 첫 이웃은 글 5편(최근 24시간), 나머지는 글 없음
    await insertPosts(neighbors[0], 5);

    await page.goto("/town");
    const plaza = page.locator("[data-phone-plaza]");
    await expect(plaza).toBeVisible();
    const diorama = plaza.locator("[data-village-diorama]");
    await expect(diorama).toHaveAttribute("data-season", /^(spring|summer|autumn|winter)$/);
    await expect(plaza.locator("[data-lantern-string]")).toHaveCount(1);
    const lanterns = plaza.locator("[data-lantern]");
    await expect(lanterns).toHaveCount(3);
    await expect(plaza.locator('[data-lantern][data-lit="1"]')).toHaveCount(1);
    await expect(plaza.locator("[data-plaza-lit]")).toHaveText("불 켜진 집 1채");

    // 집 그림 + 이름 한 링크 (44px 이상)
    const houses = plaza.locator("[data-diorama-house]");
    await expect(houses).toHaveCount(3);
    await expect(houses.first()).toHaveAttribute("href", `/@${me}`);
    for (const h of await houses.all()) {
      const box = (await h.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    await expect(houses.nth(1)).toHaveAttribute("href", `/@${neighbors[0]}`);

    // 이웃 띠: 이웃 수만큼, 글 쓴 이웃만 켜짐·안 읽은 점
    const street = plaza.locator("[data-phone-street]");
    await expect(street).toHaveAttribute("data-phone-street", String(neighbors.length));
    await expect(street.locator("[data-street-house]")).toHaveCount(neighbors.length);
    const first = street.locator(`[data-street-house="${neighbors[0]}"]`);
    await expect(first).toHaveAttribute("data-lit", "1");
    await expect(first.locator("[data-street-unread]")).toHaveCount(1);
    await expect(street.locator(`[data-street-house="${neighbors[1]}"] [data-street-unread]`)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await first.click();
    const sheet = page.locator(`dialog[open][data-phone-sheet="${neighbors[0]}"]`);
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: `${neighbors[0]}님의 집` })).toBeVisible();
    await expect(sheet.locator("[data-sheet-post]")).toHaveCount(3);
    await expect(sheet.locator("[data-sheet-post]").first()).toHaveAttribute("href", new RegExp(`^/@${neighbors[0]}/\\d+$`));
    await sheet.getByRole("button", { name: "닫기" }).click();
    await expect(sheet).toHaveCount(0);

    await street.locator(`[data-street-house="${neighbors[2]}"]`).click();
    const empty = page.locator(`dialog[open][data-phone-sheet="${neighbors[2]}"]`);
    await expect(empty).toContainText("아직 공개 글이 없어요.");
    await page.keyboard.press("Escape");
    await expect(empty).toHaveCount(0);

    // 집 링크를 누르면 그 블로그
    await houses.nth(1).click();
    await expect(page).toHaveURL(new RegExp(`/@${neighbors[0]}$`));
  });

  test("?season=winter면 디오라마도 겨울, 이웃이 없으면 띠가 없다", async ({ page }) => {
    await signUpOk(page);
    await page.goto("/town?season=winter");
    const diorama = page.locator("[data-phone-plaza] [data-village-diorama]");
    await expect(diorama).toHaveAttribute("data-season", "winter");
    await expect(page.locator("[data-phone-street]")).toHaveCount(0);
    await page.goto("/town?season=nope");
    await expect(diorama).toHaveAttribute("data-season", /^(spring|summer|autumn|winter)$/);
  });
});
