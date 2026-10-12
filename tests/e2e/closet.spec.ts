import { expect, test, type Browser, type Page } from "./fixtures";
import { signUpOk, sql, uid } from "./helpers";

// 꾸미기 (SHOP-04·06), specs/036-closet
test.describe.configure({ timeout: 90_000 });

const userId = async (username: string) => (await sql`select id from users where username = ${username}`)[0].id as string;
const itemId = async (code: string) => (await sql`select id from items where code = ${code}`)[0].id as number;
const equips = (id: string) => sql`select e.slot, i.code from avatar_equips e join items i on i.id = e.item_id where e.user_id = ${id} order by e.slot`;
/** 화면을 거치지 않고 아이템을 준다 */
const give = async (id: string, ...codes: string[]) => {
  for (const code of codes) await sql`insert into user_items (user_id, item_id) select ${id}, id from items where code = ${code}`;
};
const item = (page: Page, name: string) => page.locator(`[data-closet-item="${name}"]`);
const miniroom = (page: Page) => page.locator("main [data-miniroom]").first();
const notice = (page: Page) => page.locator("[data-equip-result]");

async function member(browser: Browser) {
  const page = await browser.newPage();
  const username = await signUpOk(page);
  return { page, username, id: await userId(username) };
}

test.describe("SHOP-04·06 꾸미기", () => {
  test("가입하면 초원이 걸려 있고, 아바타 아이템이 없으면 안내, 블로그 홈 주인 도구에서 들어간다", async ({ browser }) => {
    const { page, username } = await member(browser);
    await page.goto(`/@${username}`);
    await expect(miniroom(page)).toHaveAttribute("data-background", "bg.meadow");
    await page.getByRole("navigation", { name: "주인 도구" }).getByRole("link", { name: "🎨 꾸미기" }).click();
    await expect(page).toHaveURL(/\/closet$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("🎨 꾸미기");
    await expect(miniroom(page)).toHaveAttribute("data-background", "bg.meadow");
    await expect(page.getByText("아직 아바타 아이템이 없어요. 상점에서 모자·옷·소품을 사 보세요.")).toBeVisible();
    await expect(item(page, "초원")).toHaveAttribute("aria-pressed", "true");
    await expect(item(page, "초원")).toContainText("✓ 초원");
    await expect(page.getByRole("heading", { name: "🪑 가구" })).toHaveCount(0);
    await page.close();
  });

  test("모자를 입으면 저장 표시·헤더·블로그에 보이고, 같은 부위는 하나만, 다시 누르면 벗는다. 배경은 블로그 미니룸에", async ({ browser }) => {
    const { page, username, id } = await member(browser);
    await give(id, "hat_straw", "hat_ribbon", "acc_glasses", "bg_beach", "furn_rug");
    await page.goto("/closet");
    await expect(page.getByRole("heading", { name: "🪑 가구" })).toBeVisible();
    await expect(page.locator('[data-closet-furniture="알록달록 러그"]')).toBeVisible();

    await item(page, "밀짚모자").click();
    await expect(item(page, "밀짚모자")).toHaveAttribute("aria-pressed", "true");
    await expect(notice(page)).toHaveText("밀짚모자 장착을 저장했어요 ✓");
    await expect(miniroom(page).locator("svg[data-art]").last()).toHaveAttribute("data-art", "char.boy hat.straw");
    await expect(page.locator("header [data-wallet] svg")).toHaveAttribute("data-art", "char.boy hat.straw");
    await expect(notice(page)).toHaveCount(0, { timeout: 5_000 }); // 2초 뒤 사라짐

    // 같은 부위는 바뀌고, 다른 부위는 함께
    await item(page, "리본").click();
    await expect(notice(page)).toHaveText("리본 장착을 저장했어요 ✓");
    await item(page, "안경").click();
    await expect(notice(page)).toHaveText("안경 장착을 저장했어요 ✓");
    await expect(item(page, "밀짚모자")).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => equips(id)).toEqual([
      { slot: "accessory", code: "acc_glasses" },
      { slot: "hat", code: "hat_ribbon" },
    ]);
    await expect(miniroom(page).locator("svg[data-art]").last()).toHaveAttribute("data-art", "char.boy acc.glasses hat.ribbon");

    await item(page, "리본").click();
    await expect(notice(page)).toHaveText("리본을 벗었어요 ✓");
    await expect.poll(() => equips(id)).toEqual([{ slot: "accessory", code: "acc_glasses" }]);

    await item(page, "바닷가").click();
    await expect(notice(page)).toHaveText("바닷가 장착을 저장했어요 ✓");
    await expect(item(page, "초원")).toHaveAttribute("aria-pressed", "false");
    await page.goto(`/@${username}`);
    await expect(miniroom(page)).toHaveAttribute("data-background", "bg.beach");
    await expect(miniroom(page).locator("svg[data-art]").last()).toHaveAttribute("data-art", "char.boy acc.glasses");

    // 다른 회원에게도 같은 모습
    const other = await browser.newPage();
    await other.goto(`/@${username}`);
    await expect(miniroom(other)).toHaveAttribute("data-background", "bg.beach");
    await other.close();
    await page.close();
  });

  test("가지고 있지 않은 아이템은 서버와 DB가 막고 화면은 되돌린다", async ({ browser }) => {
    const { page, id } = await member(browser);
    await give(id, "hat_straw");
    await page.goto("/closet");
    const notOwned = await itemId("hat_beanie");
    await page.route("**/*", async (route) => {
      const req = route.request();
      if (req.method() !== "POST" || req.headers()["next-action"] === undefined) return route.continue();
      await route.continue({ postData: (req.postData() ?? "").replace(/\d+/, String(notOwned)) });
    });
    await item(page, "밀짚모자").click();
    await expect(page.locator('[data-equip-result="error"]')).toHaveText("가지고 있지 않은 아이템이에요");
    await expect(item(page, "밀짚모자")).toHaveAttribute("aria-pressed", "false");
    await page.unrouteAll();
    expect(await equips(id)).toEqual([]);

    await expect(sql`insert into avatar_equips (user_id, slot, item_id) values (${id}, 'hat', ${notOwned})`).rejects.toThrow();
    await expect(sql`update blogs set background_item_id = ${await itemId("bg_space")} where owner_id = ${id}`).rejects.toThrow();
    await expect(sql`insert into avatar_equips (user_id, slot, item_id) values (${id}, ${uid("x")}, ${await itemId("hat_straw")})`).rejects.toThrow();
    await page.close();
  });
});
