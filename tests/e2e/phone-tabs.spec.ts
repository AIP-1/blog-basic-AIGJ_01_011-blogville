import { expect, test } from "./fixtures";
import { signUpOk, sql, writePost } from "./helpers";

// 휴대폰 아래 탭 (TOWN-11·12, NF-06), specs/040-phone-tabs
test.describe.configure({ timeout: 90_000 });

const PHONE = { width: 375, height: 800 };

test.describe("TOWN-11 휴대폰 아래 탭", () => {
  test("회원: 아래 탭으로 내 블로그·마을 소식·상점·알림을 오가고, 헤더에서는 겹치는 버튼이 빠진다", async ({ browser }) => {
    const page = await browser.newPage({ viewport: PHONE });
    const username = await signUpOk(page);
    // 가입 직후 환영 문구는 휴대폰 안내
    await expect(page.getByText("화면 아래 탭으로 마을 소식·상점·알림을 오가고")).toBeVisible();
    await expect(page.getByText("🚪 밖으로를 눌러 마을을 구경해 보세요")).toBeHidden();

    const tabs = page.getByRole("navigation", { name: "아래 탭" });
    await expect(tabs).toBeVisible();
    await expect(tabs.getByRole("link")).toHaveCount(5);
    await expect(tabs.getByRole("link", { name: "내 블로그" })).toHaveAttribute("aria-current", "page");
    for (const href of ["/feed", "/shop", "/attendance", "/notifications", `/@${username}`]) {
      await expect(page.locator(`body > header a.btn[href="${href}"]`)).toBeHidden();
    }
    // 탭이 화면 맨 아래에 붙고, 마지막 줄이 가리지 않게 페이지 아래가 띄워져 있다
    const box = (await tabs.boundingBox())!;
    expect(Math.round(box.y + box.height)).toBe(PHONE.height);
    expect(box.height).toBeGreaterThanOrEqual(56);
    expect(await page.evaluate(() => getComputedStyle(document.body).paddingBottom)).toBe("56px");

    await tabs.getByRole("link", { name: "마을 소식" }).click();
    await expect(page).toHaveURL("/feed");
    await expect(tabs.getByRole("link", { name: "마을 소식" })).toHaveAttribute("aria-current", "page");
    await expect(tabs.getByRole("link", { name: "내 블로그" })).not.toHaveAttribute("aria-current", "page");
    await tabs.getByRole("link", { name: "상점" }).click();
    await expect(page).toHaveURL("/shop");
    await tabs.getByRole("link", { name: /^알림/ }).click();
    await expect(page).toHaveURL("/notifications");
    await expect(tabs.getByRole("link", { name: /^알림/ })).toHaveAttribute("aria-current", "page");
    // 글 화면에서도 🏠 내 블로그가 켜진다
    const postId = await writePost(page, "아래 탭 글", "본문");
    await page.goto(`/@${username}/${postId}`);
    await expect(tabs.getByRole("link", { name: "내 블로그" })).toHaveAttribute("aria-current", "page");
    // 개발 서버의 Next.js 도구 단추가 왼쪽 아래(첫 탭 위)에 떠 있어 키보드로 누른다
    await tabs.getByRole("link", { name: "내 블로그" }).press("Enter");
    await expect(page).toHaveURL(`/@${username}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(PHONE.width);
    await page.close();
  });

  test("🔔 탭에 안 읽은 알림 수, ☰ 메뉴는 마을 대신 펼친 메뉴 화면(텔레포트 없음)", async ({ browser }) => {
    const page = await browser.newPage({ viewport: PHONE });
    const username = await signUpOk(page);
    const [{ id: userId }] = await sql`select id from users where username = ${username}`;
    const [{ id: actorId }] = await sql`select id from users where username <> ${username} limit 1`;
    const postId = await writePost(page, "알림 받을 글", "본문");
    await sql`insert into notifications (user_id, kind, actor_id, post_id)
      select ${userId}, 'comment', ${actorId}, ${postId} from generate_series(1, 3)`;
    await page.goto(`/@${username}`);
    const tabs = page.getByRole("navigation", { name: "아래 탭" });
    await expect(tabs.getByRole("link", { name: "알림, 안 읽은 알림 3개" })).toBeVisible();
    await expect(tabs.locator("[data-unread]")).toHaveText("3");

    await tabs.getByRole("link", { name: "메뉴" }).click();
    await expect(page).toHaveURL("/town?menu=1");
    await expect(tabs.getByRole("link", { name: "메뉴" })).toHaveAttribute("aria-current", "page");
    const panel = page.locator('[data-town-panel="menu"]');
    await expect(panel).toBeVisible();
    await expect(page.locator("[data-town]")).toBeHidden();
    await expect(panel.getByRole("button", { name: /텔레포트/ })).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "닫기" })).toHaveCount(0);
    await expect(panel.getByRole("button", { name: /🔔 알림/ })).toContainText("안 읽은 알림 3개");
    // 열자마자 초점을 빼앗지 않는다
    await expect(page.locator("[data-panel-focus]")).not.toBeFocused();

    await panel.getByRole("button", { name: /내 프로필/ }).click();
    await expect(page.locator('[data-town-panel="profile"]')).toBeVisible();
    await expect(page.locator("[data-town-coin]")).toBeVisible();
    await expect(page.locator("[data-panel-focus]")).toBeFocused();
    await page.getByRole("button", { name: "메뉴로" }).click();
    await page.locator('[data-town-panel="menu"]').getByRole("button", { name: /친구 목록/ }).click();
    await expect(page.getByText("아직 이웃이 없어요")).toBeVisible();
    await page.getByRole("button", { name: "메뉴로" }).click();
    await page.locator('[data-town-panel="menu"]').getByRole("link", { name: "📮 출석" }).click();
    await expect(page).toHaveURL("/attendance");
    // ☰ 메뉴 없이 /town을 열면 그대로 내 블로그로
    await page.goto("/town");
    await expect(page).toHaveURL(`/@${username}`);
    await page.close();
  });

  test("방문자와 PC에는 아래 탭이 없다, PC의 /town?menu=1은 그냥 마을", async ({ browser }) => {
    const guest = await browser.newPage({ viewport: PHONE });
    await guest.goto("/feed");
    await expect(guest.locator("[data-phone-tabs]")).toHaveCount(0);
    await expect(guest.locator('body > header a[href="/feed"]')).toBeVisible();
    await guest.close();

    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const username = await signUpOk(page);
    await expect(page.locator("[data-phone-tabs]")).toBeHidden();
    await expect(page.locator(`body > header a.btn[href="/@${username}"]`)).toBeVisible();
    await page.goto("/town?menu=1");
    await expect(page.locator("[data-town] canvas")).toHaveAttribute("data-ready", "1");
    await expect(page.locator("[data-town-panel]")).toBeHidden();
    await page.close();
  });
});
