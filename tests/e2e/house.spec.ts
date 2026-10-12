import { expect, test, type Browser, type Page } from "./fixtures";
import { signUpOk, sql, uid } from "./helpers";

// 우리 집 가구 (SHOP-05·BLOG-04), specs/037-house
test.describe.configure({ timeout: 90_000 });

const userId = async (username: string) => (await sql`select id from users where username = ${username}`)[0].id as string;
const itemId = async (code: string) => (await sql`select id from items where code = ${code}`)[0].id as number;
const layout = (id: string) => sql`select f.slot, i.code from house_furniture f join items i on i.id = f.item_id where f.user_id = ${id} order by f.slot`;
const give = async (id: string, ...codes: string[]) => {
  for (const code of codes) await sql`insert into user_items (user_id, item_id) select ${id}, id from items where code = ${code}`;
};
const house = (page: Page) => page.locator("[data-house]");
const slots = (page: Page) => house(page).locator("[data-slot]");

async function member(browser: Browser) {
  const page = await browser.newPage();
  const username = await signUpOk(page);
  return { page, username, id: await userId(username) };
}

test.describe("SHOP-05 우리 집", () => {
  test("가입하면 1단계 작은 오두막, 화분·의자가 1·2번 칸에, 방문자도 같은 집을 보지만 버튼은 없다", async ({ browser }) => {
    const { page, username, id } = await member(browser);
    await expect(house(page).getByRole("heading")).toHaveText("🏠 우리 집 · 1단계 작은 오두막");
    await expect(house(page).locator("[data-house-summary]")).toHaveText("가구 2/4칸 · Lv.10에 집이 커져요");
    await expect(slots(page)).toHaveCount(4);
    await expect(slots(page).nth(0)).toHaveAttribute("data-furniture", "초록 화분");
    await expect(slots(page).nth(1)).toHaveAttribute("data-furniture", "나무 의자");
    expect(await layout(id)).toEqual([
      { slot: 0, code: "furn_plant" },
      { slot: 1, code: "furn_chair" },
    ]);

    const visitor = await browser.newPage();
    await visitor.goto(`/@${username}`);
    await expect(slots(visitor).nth(0)).toHaveAttribute("data-furniture", "초록 화분");
    await expect(visitor.getByRole("button", { name: "🛋 가구 놓기" })).toHaveCount(0);
    await visitor.close();
    await page.close();
  });

  test("산 가구를 놓고, 다른 칸으로 옮기고, 비우면 새로고침해도 그대로", async ({ browser }) => {
    const { page, username, id } = await member(browser);
    await give(id, "furn_sofa");
    await page.goto(`/@${username}`);
    await page.getByRole("button", { name: "🛋 가구 놓기" }).click();
    await page.getByRole("button", { name: "3번 칸에 가구 놓기" }).click();
    await expect(page.getByText("3번 칸에 놓을 가구를 골라 주세요")).toBeVisible();
    await page.locator('[data-pick="푹신한 소파"]').click();
    await expect(slots(page).nth(2)).toHaveAttribute("data-furniture", "푹신한 소파");
    await expect(house(page).locator("[data-house-summary]")).toHaveText("가구 3/4칸 · Lv.10에 집이 커져요");

    // 1번 칸의 화분을 4번 칸으로 옮긴다
    await page.getByRole("button", { name: "4번 칸에 가구 놓기" }).click();
    await page.locator('[data-pick="초록 화분"]').click();
    await expect(slots(page).nth(3)).toHaveAttribute("data-furniture", "초록 화분");
    await expect(slots(page).nth(0)).toHaveAttribute("data-furniture", "");

    // 2번 칸 의자를 비운다
    await page.getByRole("button", { name: "2번 칸: 나무 의자 바꾸기" }).click();
    await expect(page.locator('[data-pick="나무 의자"]')).toBeDisabled();
    await page.getByRole("button", { name: "🧹 비우기" }).click();
    await expect(slots(page).nth(1)).toHaveAttribute("data-furniture", "");
    await page.getByRole("button", { name: "✓ 다 놓았어요" }).click();

    await page.reload();
    await expect(house(page).locator("[data-house-summary]")).toHaveText("가구 2/4칸 · Lv.10에 집이 커져요");
    expect(await layout(id)).toEqual([
      { slot: 2, code: "furn_sofa" },
      { slot: 3, code: "furn_plant" },
    ]);
    await page.close();
  });

  test("Lv.10이 되면 2단계 창문 많은 집, 6칸", async ({ browser }) => {
    const { page, username, id } = await member(browser);
    await sql`insert into point_ledger (user_id, reason, exp_delta, coin_delta, ref_id) values (${id}, 'post', 890, 0, ${uid("seed")})`; // 10 + 890 = 900 → Lv.10
    await page.goto(`/@${username}`);
    await expect(house(page).getByRole("heading")).toHaveText("🏠 우리 집 · 2단계 창문 많은 집");
    await expect(house(page).locator("[data-house-summary]")).toHaveText("가구 2/6칸 · Lv.20에 집이 커져요");
    await expect(slots(page)).toHaveCount(6);
    await page.close();
  });

  test("요청을 조작해도: 열리지 않은 칸·없는 칸·가지지 않은 가구는 막고, DB도 막는다", async ({ browser }) => {
    const { page, username, id } = await member(browser);
    await page.goto(`/@${username}`);
    const notOwned = await itemId("furn_bed");
    const cases: [string, string][] = [
      [`["4","${await itemId("furn_chair")}"]`, "Lv.10이 되면 집이 커져서 이 자리를 쓸 수 있어요."],
      [`["6","${await itemId("furn_chair")}"]`, "Lv.20이 되면 집이 커져서 이 자리를 쓸 수 있어요."],
      [`["9","${await itemId("furn_chair")}"]`, "놓을 수 없는 자리예요."],
      [`["2","${notOwned}"]`, "가진 가구만 놓을 수 있어요."],
      [`["2","abc"]`, "가진 가구만 놓을 수 있어요."],
    ];
    await page.getByRole("button", { name: "🛋 가구 놓기" }).click();
    for (const [body, message] of cases) {
      await page.route("**/*", async (route) => {
        const req = route.request();
        if (req.method() !== "POST" || req.headers()["next-action"] === undefined) return route.continue();
        await route.continue({ postData: body });
      });
      await page.getByRole("button", { name: "3번 칸에 가구 놓기" }).click();
      const done = page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined);
      await page.locator('[data-pick="나무 의자"]').click();
      expect((await done).status()).toBe(200);
      await expect(house(page).getByRole("alert")).toHaveText(message);
      await page.unrouteAll();
    }
    expect(await layout(id)).toHaveLength(2);
    await expect(sql`insert into house_furniture (user_id, slot, item_id) values (${id}, 3, ${notOwned})`).rejects.toThrow();
    await give(id, "furn_bed");
    await expect(sql`insert into house_furniture (user_id, slot, item_id) values (${id}, 8, ${notOwned})`).rejects.toThrow();
    await expect(sql`insert into house_furniture (user_id, slot, item_id) values (${id}, 3, ${await itemId("furn_chair")})`).rejects.toThrow();
    await page.close();
  });

  test("375px: 가로 스크롤이 없다", async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
    await signUpOk(page);
    await expect(slots(page)).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await page.close();
  });
});
