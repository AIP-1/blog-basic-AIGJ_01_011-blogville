import { expect, test, type Browser, type Page } from "./fixtures";
import { signUpOk, sql, uid } from "./helpers";

// 마을 상점 (SHOP-01·02·03), specs/035-shop
test.describe.configure({ timeout: 90_000 });

const userId = async (username: string) => (await sql`select id from users where username = ${username}`)[0].id as string;
const itemId = async (code: string) => (await sql`select id from items where code = ${code}`)[0].id as number;
const coins = async (id: string) => (await sql`select coalesce(sum(coin_delta), 0)::int as c from point_ledger where user_id = ${id}`)[0].c as number;
const purchases = (id: string) => sql`select l.coin_delta, i.code from point_ledger l join items i on i.id = l.ref_id::int where l.user_id = ${id} and l.reason = 'purchase' order by l.id`;
/** 경험치 없이 코인만 더한다 (화면을 거치지 않는 준비) */
const addCoins = (id: string, coin: number) => sql`insert into point_ledger (user_id, reason, exp_delta, coin_delta, ref_id) values (${id}, 'post', 0, ${coin}, ${uid("seed")})`;
const card = (page: Page, name: string) => page.locator(`[data-item="${name}"]`);
const result = (page: Page) => page.locator("[data-buy-result]");

async function member(browser: Browser) {
  const page = await browser.newPage();
  const username = await signUpOk(page);
  return { page, id: await userId(username) };
}

test.describe("SHOP-01·02·03 마을 상점", () => {
  test("구역 세 개, 기본 아이템·캐릭터는 없고, 밀짚모자를 사면 안내·보유 중·코인 50이 준다", async ({ browser }) => {
    const { page, id } = await member(browser);
    await page.getByRole("link", { name: "마을 상점" }).click();
    await expect(page).toHaveURL(/\/shop$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("🏪 마을 상점");
    await expect(page.locator("[data-shop-wallet]")).toHaveText("Lv.1 🪙 110");
    await expect(page.locator("[data-shop-section] h2")).toHaveText(["👕 아바타 꾸미기", "🪑 가구", "🖼 배경"]);
    for (const name of ["남자 주민", "여자 주민"]) await expect(card(page, name)).toHaveCount(0);
    await expect(page.locator('[data-shop-section="avatar"] [data-item]')).toHaveCount(9);
    await expect(page.locator('[data-shop-section="furniture"] [data-item]')).toHaveCount(6);
    await expect(page.locator('[data-shop-section="background"] [data-item]')).toHaveCount(5);

    // 레벨 부족·코인 부족도 목록에는 보인다 (SHOP-02)
    await expect(card(page, "털모자").getByRole("button")).toHaveText("🔒 Lv.2");
    await expect(card(page, "털모자").getByRole("button")).toBeDisabled();
    await expect(card(page, "털모자")).toContainText("Lv.2+");
    await expect(card(page, "바닷가").getByRole("button")).toHaveText("코인 부족");

    await card(page, "밀짚모자").getByRole("button", { name: "사기" }).click();
    await expect(result(page)).toContainText("🎉 밀짚모자를 샀어요! 꾸미기에서 장착해 보세요.");
    await expect(result(page).getByRole("link", { name: "🎨 꾸미기로" })).toHaveAttribute("href", "/closet");
    await expect(card(page, "밀짚모자").getByRole("button")).toHaveText("보유 중");
    await expect(page.locator("[data-shop-wallet]")).toHaveText("Lv.1 🪙 60");
    await expect(page.locator("header [data-wallet]")).toContainText("🪙 60");
    expect(await purchases(id)).toEqual([{ coin_delta: -50, code: "hat_straw" }]);

    // 가구는 우리 집 안내, 받침 없는 이름은 `를`
    await card(page, "알록달록 러그").getByRole("button", { name: "사기" }).click();
    await expect(result(page)).toHaveText("🎉 알록달록 러그를 샀어요! 내 블로그의 우리 집에 놓을 수 있어요.");
    await expect(page.locator("[data-shop-wallet]")).toHaveText("Lv.1 🪙 10");

    await page.goto("/wallet");
    await expect(page.locator('[data-ledger="purchase"]').first()).toContainText("🏪 상점 구매");
    await expect(page.locator('[data-ledger="purchase"]').first()).toContainText("🪙 −50");
    await page.close();
  });

  test("잔액이 값과 같으면 사서 0이 되고, 정렬은 비싼 순·싼 순, 새로고침하면 레벨순", async ({ browser }) => {
    const { page, id } = await member(browser);
    await addCoins(id, 10); // 110 + 10 = 120
    await page.goto("/shop");
    const avatars = page.locator('[data-shop-section="avatar"] [data-item] h3');
    await expect(avatars.first()).toHaveText("밀짚모자");
    await page.getByLabel("정렬").selectOption({ label: "비싼 순" });
    await expect(avatars.first()).toHaveText("원피스");
    await page.getByLabel("정렬").selectOption({ label: "싼 순" });
    await expect(avatars.first()).toHaveText("밀짚모자");
    await page.getByLabel("정렬").selectOption({ label: "최신순" });
    await expect(page.locator('[data-shop-section="background"] [data-item] h3').first()).toHaveText("우주");

    await card(page, "바닷가").getByRole("button", { name: "사기" }).click();
    await expect(result(page)).toContainText("🎉 바닷가를 샀어요! 꾸미기에서 장착해 보세요.");
    await expect(page.locator("[data-shop-wallet]")).toHaveText("Lv.1 🪙 0");
    expect(await coins(id)).toBe(0);
    // 보유순은 가진 것 먼저
    await page.getByLabel("정렬").selectOption({ label: "보유순" });
    await expect(page.locator('[data-shop-section="background"] [data-item] h3').first()).toHaveText("바닷가");
    await page.reload();
    await expect(page.getByLabel("정렬")).toHaveValue("level");
    await page.close();
  });

  test("동시에 두 개를 사도 코인이 모자라면 하나만, 잔액은 0 아래로 내려가지 않는다", async ({ browser }) => {
    const { page, id } = await member(browser);
    await addCoins(id, 20); // 130: 바닷가 120 + 안경 70은 못 산다
    // 같은 회원으로 창을 하나 더
    const second = await browser.newContext({ storageState: await page.context().storageState() });
    const other = await second.newPage();
    await Promise.all([page.goto("/shop"), other.goto("/shop")]);
    await Promise.all([
      card(page, "바닷가").getByRole("button", { name: "사기" }).click(),
      card(other, "안경").getByRole("button", { name: "사기" }).click(),
    ]);
    await expect(result(page)).toBeVisible();
    await expect(result(other)).toBeVisible();
    await expect.poll(async () => (await purchases(id)).length).toBe(1);
    const left = await coins(id);
    expect(left === 10 || left === 60).toBe(true);
    await expect(page.locator('[data-buy-result="error"], [data-buy-result="ok"]')).toHaveCount(1);
    const texts = [await result(page).textContent(), await result(other).textContent()];
    expect(texts.some((t) => /코인이 \d+개 부족해요/.test(t ?? ""))).toBe(true);
    await page.close();
    await second.close();
  });

  test("요청을 조작해도 서버가 다시 확인한다: 잘못된 ID·캐릭터·이미 가진 것·레벨·코인", async ({ browser }) => {
    const { page, id } = await member(browser);
    await page.goto("/shop");
    await card(page, "리본").getByRole("button", { name: "사기" }).click();
    await expect(result(page)).toContainText("리본을 샀어요");

    const cases: [string, string][] = [
      ["abc", "살 수 없는 아이템이에요"],
      ["99999999", "살 수 없는 아이템이에요"],
      [String(await itemId("char_girl")), "살 수 없는 아이템이에요"],
      [String(await itemId("hat_ribbon")), "이미 가지고 있는 아이템이에요"],
      [String(await itemId("bg_space")), "레벨 6부터 살 수 있어요"],
      // 리본 60을 사서 50 남음 → 바닷가 120은 70개 부족
      [String(await itemId("bg_beach")), "코인이 70개 부족해요"],
      [String(await itemId("furn_table")), ""],
    ];
    for (const [forged, message] of cases) {
      await page.route("**/*", async (route) => {
        const req = route.request();
        const body = req.postData();
        if (req.method() !== "POST" || !/name="[^"]*itemId"/.test(body ?? "")) return route.continue();
        await route.continue({ postData: body!.replace(/(name="[^"]*itemId"\r\n\r\n)[^\r]*/, `$1${forged}`) });
      });
      const done = page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined);
      await card(page, "밀짚모자").getByRole("button", { name: "사기" }).click();
      expect((await done).status()).toBe(200);
      if (message) await expect(page.locator('[data-buy-result="error"]')).toHaveText(message);
      else await expect(page.locator('[data-buy-result="ok"]')).toContainText("둥근 탁자를 샀어요");
      await page.unrouteAll();
    }
    expect((await purchases(id)).map((p) => p.code)).toEqual(["hat_ribbon", "furn_table"]);
    expect(await coins(id)).toBe(10);
    await page.close();
  });

  test("375px: 카드 두 칸, 가로 스크롤이 없다", async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
    await signUpOk(page);
    await page.goto("/shop");
    await expect(card(page, "밀짚모자")).toBeVisible();
    const [a, b] = await Promise.all([card(page, "밀짚모자").boundingBox(), card(page, "리본").boundingBox()]);
    expect(a!.y).toBe(b!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await page.close();
  });
});
