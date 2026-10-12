import { expect, test } from "./fixtures";
import { signUpOk } from "./helpers";

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
