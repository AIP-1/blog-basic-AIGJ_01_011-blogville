// 레벨업 팝업 자체를 보는 시험이라 자동으로 닫는 ./fixtures 대신 그대로 쓴다
import { expect, test, type Browser, type Page } from "@playwright/test";
import { signUpOk, sql, uid } from "./helpers";

// 레벨업 알림 (GAME-06), specs/034-level-up
test.describe.configure({ timeout: 90_000 });

const popup = (page: Page) => page.getByRole("dialog");
const userId = async (username: string) => (await sql`select id from users where username = ${username}`)[0].id as string;
const levelUps = (id: string) => sql`select level, read_at is not null as read from notifications where user_id = ${id} and kind = 'level_up' order by level`;
/** 알림 없이 경험치만 더한다 (화면을 거치지 않는 준비) */
const addExp = (id: string, exp: number) => sql`insert into point_ledger (user_id, reason, exp_delta, coin_delta, ref_id) values (${id}, 'post', ${exp}, 0, ${uid("seed")})`;
const LONG = "가".repeat(120);

async function member(browser: Browser) {
  const page = await browser.newPage();
  const username = await signUpOk(page);
  return { page, username, id: await userId(username) };
}

test.describe("GAME-06 레벨업 팝업", () => {
  test("내 글 보상으로 Lv.2: 그 화면에서 바로 뜨고, [확인] 뒤에는 다시 안 뜨며 알림함에 남는다", async ({ browser }) => {
    const { page, id } = await member(browser);
    await expect(popup(page)).toHaveCount(0); // 출석 10 → Lv.1

    await page.goto("/write");
    await page.getByLabel("제목", { exact: true }).fill("레벨 글");
    await page.getByLabel("본문").click();
    await page.keyboard.insertText(LONG);
    await page.getByRole("button", { name: "발행하기" }).click();
    await expect(page).toHaveURL(/\/@[a-z0-9_]+\/\d+(\?new=1)?$/);

    await expect(popup(page)).toBeVisible();
    await expect(popup(page).getByRole("heading")).toHaveText("Lv.2가 되었어요!");
    await expect(popup(page).getByRole("button", { name: "확인" })).toBeFocused();
    expect(await levelUps(id)).toEqual([{ level: 2, read: false }]);

    await popup(page).getByRole("button", { name: "확인" }).click();
    await expect(popup(page)).toHaveCount(0);
    await expect.poll(() => levelUps(id)).toEqual([{ level: 2, read: true }]);
    await page.reload();
    await expect(page.locator("header [data-wallet]")).toContainText("Lv.2");
    await expect(popup(page)).toHaveCount(0);

    await page.goto("/notifications");
    const row = page.locator('[data-kind="level_up"]');
    await expect(row).toHaveText(/🎉 Lv\.2가 되었어요!/);
    await expect(row).toHaveAttribute("data-notification", "read");
    await row.click();
    await expect(page).toHaveURL(/\/wallet$/);
    await page.close();
  });

  test("남의 공감으로 Lv.3: 공감한 사람에게는 안 뜨고, 주인이 다음 화면을 열 때 뜬다. [상점 가기]는 /shop", async ({ browser }) => {
    const owner = await member(browser);
    await addExp(owner.id, 48); // 출석 10 + 48 = 58 (Lv.2, Lv.3은 60)
    const [{ id: postId }] = await sql`insert into posts (blog_id, title, content_html, content_text, is_public)
      select b.id, '공감 받을 글', '<p>본문</p>', '본문', true from blogs b where b.owner_id = ${owner.id} returning id`;
    const [{ slug }] = await sql`select slug from blogs where owner_id = ${owner.id}`;
    await owner.page.goto(`/@${slug}`);
    await expect(popup(owner.page)).toHaveCount(0);

    const fan = await member(browser);
    await fan.page.goto(`/@${slug}/${postId}`);
    await fan.page.getByRole("button", { name: /공감 \d+$/ }).click();
    await expect(fan.page.getByRole("button", { name: /공감 1$/ })).toBeVisible();
    await expect.poll(() => levelUps(owner.id)).toEqual([{ level: 3, read: false }]);
    await expect(popup(fan.page)).toHaveCount(0);

    // 화면을 옮기면(헤더는 그대로) 새로 받아서 띄운다
    await owner.page.getByRole("link", { name: "마을 소식" }).click();
    await expect(owner.page).toHaveURL(/\/feed$/);
    await expect(popup(owner.page).getByRole("heading")).toHaveText("Lv.3이 되었어요!");
    // Lv.3에 열린 아이템 (필요 레벨 높은 순 → ID 순, 3개 + 외 N개)
    const unlocked = popup(owner.page).locator("[data-level-up-items]");
    await expect(unlocked).toContainText("이제 이런 친구를 데려올 수 있어요");
    await expect(unlocked.getByRole("listitem")).toHaveText(["원피스", "가방", "포근한 침대"]);
    await expect(unlocked).toContainText("외 2개");
    await popup(owner.page).getByRole("button", { name: "상점 가기" }).click();
    await expect(owner.page).toHaveURL(/\/shop$/);
    await expect(popup(owner.page)).toHaveCount(0);
    expect(await levelUps(owner.id)).toEqual([{ level: 3, read: true }]);
    await owner.page.close();
    await fan.page.close();
  });

  test("안 읽은 Lv.3·Lv.4는 Lv.4 하나만, [확인]으로 둘 다 읽음. Lv.99는 최고 레벨, Esc도 [확인]과 같다", async ({ browser }) => {
    const { page, id } = await member(browser);
    await sql`insert into notifications (user_id, kind, level) values (${id}, 'level_up', 3), (${id}, 'level_up', 4)`;
    await page.reload();
    await expect(popup(page).getByRole("heading")).toHaveText("Lv.4가 되었어요!");
    // 안 읽은 Lv.3~4에 열린 아이템: Lv.4 소파·밤의 도시, Lv.3 원피스 … 외 4개 (성장 촉진제 포함)
    await expect(popup(page).locator("[data-level-up-items] li")).toHaveText(["푹신한 소파", "밤의 도시", "원피스"]);
    await expect(popup(page).locator("[data-level-up-items]")).toContainText("외 4개");
    await popup(page).getByRole("button", { name: "확인" }).click();
    await expect.poll(() => levelUps(id)).toEqual([
      { level: 3, read: true },
      { level: 4, read: true },
    ]);

    await sql`insert into notifications (user_id, kind, level) values (${id}, 'level_up', 99)`;
    await page.reload();
    await expect(popup(page).getByRole("heading")).toHaveText("최고 레벨 Lv.99가 되었어요!");
    await expect(popup(page).locator("[data-level-up-items]")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(popup(page)).toHaveCount(0);
    await expect.poll(async () => (await levelUps(id)).at(-1)).toEqual({ level: 99, read: true });
    await page.reload();
    await expect(page.locator("header [data-wallet]")).toBeVisible();
    await expect(popup(page)).toHaveCount(0);
    await page.close();
  });

  test("레벨이 오르지 않은 보상은 알림이 없고, 같은 레벨은 한 줄만, 조작한 읽음 요청은 아무것도 바꾸지 않는다", async ({ browser }) => {
    const { page, id } = await member(browser);
    // 출석 10 → 짧은 글은 보상 없음 → 알림 없음
    expect(await levelUps(id)).toEqual([]);
    await expect(sql`insert into notifications (user_id, kind, level) values (${id}, 'level_up', 5), (${id}, 'level_up', 5)`).rejects.toThrow();
    await expect(sql`insert into notifications (user_id, kind, level) values (${id}, 'level_up', 100)`).rejects.toThrow();
    await expect(sql`insert into notifications (user_id, kind, level) values (${id}, 'level_up', 1)`).rejects.toThrow();

    await sql`insert into notifications (user_id, kind, level) values (${id}, 'level_up', 5)`;
    for (const forged of ["100", "0", "abc"]) {
      await page.route("**/*", async (route) => {
        const req = route.request();
        const body = req.postData();
        if (req.method() !== "POST" || !/name="[^"]*level"/.test(body ?? "")) return route.continue();
        await route.continue({ postData: body!.replace(/(name="[^"]*level"\r\n\r\n)[^\r]*/, `$1${forged}`) });
      });
      await page.reload();
      await expect(popup(page).getByRole("heading")).toHaveText("Lv.5가 되었어요!");
      const done = page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined);
      await popup(page).getByRole("button", { name: "확인" }).click();
      expect((await done).status()).toBe(200);
      await page.unrouteAll();
      expect(await levelUps(id)).toEqual([{ level: 5, read: false }]);
    }
    await page.close();
  });
});
