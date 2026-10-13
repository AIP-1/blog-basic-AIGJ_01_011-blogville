import { expect, test } from "./fixtures";
import { signUpOk, sql } from "./helpers";

// 소셜 로그인·연동 (AUTH-01, AUTH-05). 시험 서버에는 키가 없어서, 키가 없을 때 숨는지와 연동 표시·해제를 본다.
// 키가 있을 때 카카오·Google 인증 주소로 보내는 흐름은 가짜 키로 띄운 서버에서 손으로 확인했다 (PR 설명).
const hasKeys = ["KAKAO", "NAVER", "GOOGLE"].some((p) => process.env[`${p}_CLIENT_ID`] && process.env[`${p}_CLIENT_SECRET`]);

test.describe("AUTH-01 간편 로그인", () => {
  test.skip(hasKeys, "키가 있는 서버에서는 버튼이 보인다");

  test("키가 없으면 첫 화면에 간편 로그인 칸이 없다", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "로그인", exact: true })).toBeVisible();
    await expect(page.locator("[data-social-login]")).toHaveCount(0);
  });

  test("연동 안 된 계정으로 돌아오면 연동 안내를 보인다", async ({ page }) => {
    await page.goto("/?error=signup_disabled");
    // Next가 붙이는 화면 전환 안내(#__next-route-announcer__)도 role=alert라서 문구로 찾는다
    await expect(page.getByRole("alert").filter({ hasText: "연동된 계정이 없어요" })).toHaveText("연동된 계정이 없어요. 아이디로 로그인한 뒤 내 정보에서 연동해 주세요");
  });

  test("라이브러리의 소셜 로그인·연동 시작 경로와 키 없는 콜백은 닫혀 있다", async ({ request }) => {
    for (const path of ["/api/auth/sign-in/social", "/api/auth/link-social", "/api/auth/callback/kakao"]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  });
});

test.describe("AUTH-05 내 정보 로그인 수단", () => {
  test.skip(hasKeys, "키가 있는 서버에서는 연동하기 버튼이 보인다");

  test("아이디 로그인만 있으면 준비 중 안내, 연동한 계정은 날짜와 해제 버튼", async ({ page }) => {
    const username = await signUpOk(page);
    await page.goto("/settings/account");
    const section = page.locator("[data-social-accounts]");
    await expect(section).toContainText(`아이디 로그인 · ${username}`);
    await expect(section).toContainText("간편 로그인(카카오·네이버·Google)은 준비 중이에요");

    // 키를 빼기 전에 연동해 둔 계정은 보이고 해제할 수 있다
    await sql`insert into accounts (id, user_id, account_id, provider_id)
      select ${`t_${username}`}, id, ${`k_${username}`}, 'kakao' from users where username = ${username}`;
    await page.reload();
    const row = section.locator("[data-social-row=kakao]");
    await expect(row).toContainText("연동됨");
    await row.getByRole("button", { name: "연동 해제" }).click();
    await expect(page.getByRole("status")).toHaveText("카카오 연동을 해제했어요");
    await expect(section.locator("[data-social-row]")).toHaveCount(0);
    const left = await sql`select provider_id from accounts a join users u on u.id = a.user_id where u.username = ${username}`;
    expect(left.map((r) => r.provider_id)).toEqual(["credential"]);
  });
});
