import { expect, test } from "./fixtures";
import { signUpOk, sql, uid } from "./helpers";

// 미용실 (SHOP-07), specs/052-salon
test.describe.configure({ timeout: 90_000 });

const userId = async (username: string) => (await sql`select id from users where username = ${username}`)[0].id as string;
const coins = async (id: string) => (await sql`select coalesce(sum(coin_delta), 0)::int as c from point_ledger where user_id = ${id}`)[0].c as number;
const addCoins = (id: string, coin: number) => sql`insert into point_ledger (user_id, reason, exp_delta, coin_delta, ref_id) values (${id}, 'post', 0, ${coin}, ${uid("seed")})`;
const worn = async (id: string) =>
  (await sql`select e.slot, i.code from avatar_equips e join items i on i.id = e.item_id where e.user_id = ${id} order by e.slot`).map((r) => `${r.slot}:${r.code}`);

test.describe("SHOP-07 미용실", () => {
  test("무료 머리는 코인 없이, 유료 색은 사서 바꾸고, 옷가게 거울에도 보이며, 조작은 막힌다", async ({ page }) => {
    const me = await signUpOk(page);
    const id = await userId(me);
    await addCoins(id, 100);
    const start = await coins(id);
    await page.goto("/salon");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("💇 반짝 미용실");
    const submit = page.locator("[data-style-submit]");
    await expect(submit).toHaveText("지금 모습이에요");

    // 무료 단발
    await page.getByRole("button", { name: /단발/ }).click();
    await expect(page.locator("[data-mirror]")).toHaveAttribute("data-mirror", /~bald.*hair\.bob/);
    await expect(submit).toHaveText("✨ 적용하기");
    await submit.click();
    await expect(page.locator("[data-style-message]")).toHaveText("✨ 새 머리가 잘 어울려요!");
    expect(await worn(id)).toEqual(["hair:hair_bob"]);
    expect(await coins(id)).toBe(start);
    expect(await sql`select 1 from point_ledger where user_id = ${id} and reason = 'purchase'`).toHaveLength(0);

    // 유료 금발 30
    await page.getByRole("tab", { name: "🎨 머리 색" }).click();
    await page.getByRole("button", { name: /금발/ }).click();
    await expect(submit).toHaveText("🪙 30 내고 적용하기");
    await submit.click();
    await expect(page.locator("[data-style-message]")).toHaveText("🎉 금발을 🪙 30에 샀어요. 새 머리가 잘 어울려요!");
    expect(await worn(id)).toEqual(["hair:hair_bob", "hair_color:haircolor_blond"]);
    expect(await coins(id)).toBe(start - 30);

    // 잠긴 레벨(은발 Lv.3), 합계 조작
    await page.getByRole("button", { name: /은발/ }).click();
    await expect(submit).toHaveText("🔒 Lv.3부터 살 수 있어요");
    await page.getByRole("button", { name: /원래 색/ }).click();
    await expect(submit).toHaveText("✨ 적용하기");
    await page.locator('input[name="pay"]').evaluate((el: HTMLInputElement) => (el.value = "7"));
    await submit.click();
    await expect(page.locator("[data-style-message]")).toHaveText("가격이 바뀌었어요. 화면을 새로 고쳐 주세요");
    expect(await worn(id)).toEqual(["hair:hair_bob", "hair_color:haircolor_blond"]);

    // 옷가게 거울에도 바꾼 머리
    await page.goto("/clothes");
    await expect(page.locator("[data-mirror]")).toHaveAttribute("data-mirror", /hair\.bob~#f2cf6b/);
    // 상점에는 머리가 없다
    await page.goto("/shop");
    await expect(page.getByText("단발", { exact: true })).toHaveCount(0);
  });

  test("방문자는 첫 화면으로, 375px에서 가로 스크롤 없음", async ({ page }) => {
    await page.goto("/salon");
    await expect(page).not.toHaveURL(/\/salon/);
    await signUpOk(page);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/salon");
    await expect(page.locator("[data-mirror]")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
