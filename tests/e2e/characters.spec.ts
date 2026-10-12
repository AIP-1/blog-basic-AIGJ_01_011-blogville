import { expect, test, type Page } from "./fixtures";
import { PASSWORD, sql, uid } from "./helpers";

// 도트 캐릭터 고르기 (GAME-01), specs/032-pixel-characters
const card = (page: Page, name: string) => page.getByRole("radio", { name });

async function fillSignUp(page: Page, username: string, confirm = PASSWORD) {
  await page.goto("/");
  await page.getByRole("tab", { name: "회원가입" }).click();
  await page.getByLabel("아이디").fill(username);
  await page.getByLabel("비밀번호", { exact: true }).fill(PASSWORD);
  await page.getByLabel("비밀번호 확인").fill(confirm);
}

const owned = (username: string) =>
  sql`select i.code from user_items ui join items i on i.id = ui.item_id join users u on u.id = ui.user_id where u.username = ${username} order by i.id`;

test.describe("GAME-01 기본 캐릭터 받기", () => {
  test("카드 2개(처음엔 남자 주민), 여자 주민을 고르면 오류 뒤에도 그대로, 가입하면 여자 주민만 갖고 장착해 헤더·블로그 홈에 보인다", async ({ page }) => {
    const username = uid();
    await fillSignUp(page, username, "다른비밀번호1");
    const group = page.getByRole("radiogroup", { name: "캐릭터 고르기" });
    await expect(group.getByRole("radio")).toHaveCount(2);
    await expect(card(page, "남자 주민")).toHaveAttribute("data-character-card", "on");
    await expect(card(page, "남자 주민")).toBeChecked();
    await expect(card(page, "남자 주민").locator("svg")).toHaveAttribute("data-character", "char.boy");
    // 화살표로도 고른다
    await card(page, "남자 주민").focus();
    await page.keyboard.press("ArrowRight");
    await expect(card(page, "여자 주민")).toBeChecked();
    await expect(card(page, "여자 주민")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(card(page, "남자 주민")).toBeChecked();
    await card(page, "여자 주민").click();
    await expect(card(page, "여자 주민")).toBeChecked();
    await expect(card(page, "남자 주민")).toHaveAttribute("data-character-card", "off");

    // 다른 칸 오류 뒤에도 고른 캐릭터는 그대로
    await page.getByRole("button", { name: "회원가입" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "비밀번호가 서로 달라요" })).toBeVisible();
    await expect(card(page, "여자 주민")).toBeChecked();

    await page.getByLabel("비밀번호", { exact: true }).fill(PASSWORD);
    await page.getByLabel("비밀번호 확인").fill(PASSWORD);
    await page.getByRole("button", { name: "회원가입" }).click();
    await expect(page).toHaveURL(new RegExp(`/@${username}\\?welcome=1$`));
    // 고른 캐릭터와 기본 배경 초원(SHOP-04)·기본 가구(SHOP-05)
    expect((await owned(username)).map((r) => r.code).sort()).toEqual(["bg_meadow", "char_girl", "furn_chair", "furn_plant"]);
    const [p] = await sql`select i.code from profiles p join users u on u.id = p.user_id join items i on i.id = p.character_item_id where u.username = ${username}`;
    expect(p.code).toBe("char_girl");
    await expect(page.locator("header [data-wallet] svg")).toHaveAttribute("data-art", "char.girl");
    await expect(page.locator("main header [data-avatar-character] svg")).toHaveAttribute("data-art", "char.girl");
  });

  test("기본 캐릭터가 아닌 ID나 이상한 값을 보내면 `고를 수 없는 캐릭터예요`, 가입되지 않는다", async ({ page }) => {
    for (const forged of ["999999", "abc", "0"]) {
      const username = uid();
      await fillSignUp(page, username);
      await page.route("**/*", async (route) => {
        const req = route.request();
        const body = req.postData();
        if (req.method() !== "POST" || !/name="[^"]*characterId"/.test(body ?? "")) return route.continue();
        await route.continue({ postData: body!.replace(/(name="[^"]*characterId"\r\n\r\n)[^\r]*/, `$1${forged}`) });
      });
      await page.getByRole("button", { name: "회원가입" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "고를 수 없는 캐릭터예요" })).toBeVisible();
      await page.unrouteAll();
      expect(await sql`select 1 from users where username = ${username}`).toHaveLength(0);
    }
  });
});
