import { expect, test } from "./fixtures";
import { signUpOk, sql, uid } from "./helpers";

// 옷가게 (SHOP-08), specs/051-clothes-shop
test.describe.configure({ timeout: 90_000 });

const userId = async (username: string) => (await sql`select id from users where username = ${username}`)[0].id as string;
const coins = async (id: string) => (await sql`select coalesce(sum(coin_delta), 0)::int as c from point_ledger where user_id = ${id}`)[0].c as number;
const addCoins = (id: string, coin: number) => sql`insert into point_ledger (user_id, reason, exp_delta, coin_delta, ref_id) values (${id}, 'post', 0, ${coin}, ${uid("seed")})`;
const worn = async (id: string) =>
  (await sql`select e.slot, i.code from avatar_equips e join items i on i.id = e.item_id where e.user_id = ${id} order by e.slot`).map((r) => `${r.slot}:${r.code}`);

test.describe("SHOP-08 옷가게", () => {
  test("거울로 입어 보고 한 번에 사서 입기, 잠긴 레벨, 벗기, 합계 조작은 막힘", async ({ page }) => {
    const me = await signUpOk(page);
    const id = await userId(me);
    await addCoins(id, 200);
    const start = await coins(id);
    await page.goto("/clothes");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("👗 꼬까 옷가게");
    const submit = page.locator("[data-outfit-submit]");
    await expect(submit).toHaveText("지금 모습이에요");
    await expect(submit).toBeDisabled();

    // 옷 탭에서 줄무늬 잠옷 → 거울이 바로 그 모습, 계산서 90
    await page.getByRole("button", { name: /줄무늬 잠옷/ }).click();
    await expect(page.locator("[data-mirror]")).toHaveAttribute("data-mirror", /clothes\.pajama/);
    await expect(page.locator("[data-bill-total]")).toHaveText("🪙 90");
    // 돌려 보기
    await page.getByRole("button", { name: "뒤", exact: true }).click();
    await expect(page.locator("[data-mirror]")).toHaveAttribute("data-mirror-dir", "up");

    // 모자 탭의 요리사 모자는 Lv.2부터
    await page.getByRole("tab", { name: "🎩 모자" }).click();
    await page.getByRole("button", { name: /요리사 모자/ }).click();
    await expect(submit).toHaveText("🔒 Lv.2부터 살 수 있어요");
    await expect(submit).toBeDisabled();
    await page.getByRole("button", { name: /안 쓰기/ }).click();

    await expect(submit).toHaveText("🪙 90 내고 입기");
    await submit.click();
    await expect(page.locator("[data-outfit-message]")).toHaveText("🎉 줄무늬 잠옷을 🪙 90에 샀어요. 새 옷이 잘 어울려요!");
    expect(await coins(id)).toBe(start - 90);
    expect(await worn(id)).toEqual(["clothes:clothes_pajama"]);
    await expect(submit).toHaveText("지금 모습이에요");

    // 벗기는 무료
    await page.getByRole("tab", { name: "👕 옷" }).click();
    await page.getByRole("button", { name: /안 입기/ }).click();
    await expect(submit).toHaveText("✨ 입기");
    await submit.click();
    await expect(page.locator("[data-outfit-message]")).toHaveText("✨ 새 옷이 잘 어울려요!");
    expect(await worn(id)).toEqual([]);
    expect(await coins(id)).toBe(start - 90);

    // 가진 잠옷을 다시 입는데 합계를 바꿔 보내면 막힌다
    await page.getByRole("button", { name: /줄무늬 잠옷/ }).click();
    await expect(page.getByRole("button", { name: /줄무늬 잠옷/ })).toContainText("보유 ✓");
    await page.locator('input[name="pay"]').evaluate((el: HTMLInputElement) => (el.value = "5"));
    await submit.click();
    await expect(page.locator("[data-outfit-message]")).toHaveText("가격이 바뀌었어요. 화면을 새로 고쳐 주세요");
    expect(await worn(id)).toEqual([]);
    expect(await coins(id)).toBe(start - 90);
  });

  test("방문자는 첫 화면으로, 375px에서 가로 스크롤 없음", async ({ page }) => {
    await page.goto("/clothes");
    await expect(page).not.toHaveURL(/\/clothes/);
    await signUpOk(page);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/clothes");
    await expect(page.locator("[data-mirror]")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
