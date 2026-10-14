import { expect, test } from "./fixtures";
import { openMyMenu, signUpOk } from "./helpers";

// 상단바: 왼쪽 로고·큰 메뉴(지금 보는 곳 표시), 오른쪽 레벨·코인·알림·글쓰기·내 메뉴(캐릭터+닉네임+▾).
test.describe("상단바", () => {
  test("내 메뉴 버튼은 닉네임과 ▾로 누를 수 있다는 걸 보여 주고, 처음 한 번만 말풍선, 열면 계정 메뉴, Esc로 닫힌다", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addCookies([{ name: "show_hint", value: "1", url: "http://localhost:3000" }]);
    const page = await context.newPage();
    const me = await signUpOk(page);
    const button = page.locator("header").getByRole("button", { name: "내 메뉴" });
    await expect(button).toContainText(me);
    await expect(button).toHaveAttribute("aria-expanded", "false");

    // 처음 온 회원: 말풍선 → [알겠어요]로 닫으면 다시 안 뜬다
    const hint = page.locator("[data-my-menu-hint]");
    await expect(hint).toContainText("여기를 누르면");
    await hint.getByRole("button", { name: "알겠어요" }).click();
    await expect(hint).toHaveCount(0);
    await page.reload();
    await expect(button).toBeVisible();
    await expect(hint).toHaveCount(0);

    const menu = await openMyMenu(page);
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(menu.getByRole("link")).toContainText(["내 블로그", "블로그 관리", "내 정보", "마을 상점", "출석 체크", "경험치·코인 내역"]);
    await expect(menu.getByRole("button", { name: "로그아웃" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(button).toBeFocused();

    // 큰 메뉴: 지금 보는 곳
    await page.locator("header").getByRole("link", { name: "인기 글" }).click();
    await expect(page).toHaveURL(/\/popular$/);
    await expect(page.locator("header").getByRole("link", { name: "인기 글" })).toHaveAttribute("aria-current", "page");
    await context.close();
  });
});
