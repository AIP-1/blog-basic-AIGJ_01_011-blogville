import { expect, test } from "./fixtures";
import { signUpOk, sql, uid } from "./helpers";

test("375px: 가로 스크롤 없음, 버튼은 44px 이상 (NF-06)", async ({ page }) => {
  const username = await signUpOk(page);
  for (const path of ["/write", "/settings/blog", "/settings/account", `/@${username}`]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
    const small = await page.$$eval(".btn", (els) =>
      els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => e.getBoundingClientRect()).filter((r) => r.height < 44 || r.width < 44).length,
    );
    expect(small, path).toBe(0);
  }
});

test("360px 회원 헤더: Lv 두 자리·코인 네 자리여도 Lv 칩이 한 줄이고 가로로 넘치지 않는다 (로고 집 마크는 휴대폰에서 숨김)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const username = await signUpOk(page);
  const [{ id }] = await sql`select id from users where username = ${username}`;
  // 화면을 거치지 않고 Lv.12(경험치 1320)·코인 1,234 넘게
  await sql`insert into point_ledger (user_id, reason, exp_delta, coin_delta, ref_id) values (${id}, 'post', 1320, 1234, ${uid("seed")})`;
  for (const path of [`/@${username}`, "/feed"]) {
    await page.goto(path);
    const wallet = page.locator("header [data-wallet]");
    await expect(wallet).toContainText(/Lv\.\d{2}/);
    await expect(wallet).toContainText(/🪙 \d,\d{3}/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(360);
    // Lv 칩이 'Lv' / '.12'로 접히지 않는다 (한 줄 높이)
    const chip = wallet.locator("span").first();
    expect((await chip.boundingBox())!.height, path).toBeLessThanOrEqual(22);
    await expect(page.locator("header").getByRole("link", { name: "Blogville" }).locator("svg")).toBeHidden();
  }
});
