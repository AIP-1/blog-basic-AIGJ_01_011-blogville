import { expect, test } from "@playwright/test";
import { signUpOk, uid } from "./helpers";

test.describe("US5 블로그 설정·닉네임", () => {
  test("이름·소개 저장과 문구", async ({ page }) => {
    const username = await signUpOk(page);
    await page.goto("/settings/blog");
    await page.getByLabel("블로그 이름").fill("   ");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.locator("p[role=alert]")).toHaveText("블로그 이름을 적어 주세요");
    await expect(page.getByLabel("블로그 이름")).toHaveValue("   ");

    await page.getByLabel("블로그 이름").fill("나의 작은 정원");
    await page.getByLabel("소개").fill("a".repeat(160));
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByRole("status")).toHaveText("저장했어요 ✓");
    await page.goto(`/@${username}`);
    await expect(page.getByRole("heading", { name: "나의 작은 정원" })).toBeVisible();
  });

  test("주소 바꾸기: 소문자로 저장, 예전 주소 404, 예약어·형식 문구", async ({ page }) => {
    const username = await signUpOk(page);
    const next = uid("n");
    await page.goto("/settings/blog");
    const slug = page.getByLabel("블로그 주소");
    const save = page.getByRole("button", { name: "주소 바꾸기" });

    await slug.fill("ab");
    await save.click();
    await expect(page.locator("p[role=alert]")).toHaveText("주소는 영문 소문자, 숫자, _ 로 3~20자예요");
    await slug.fill("settings");
    await save.click();
    await expect(page.locator("p[role=alert]")).toHaveText("이 주소는 쓸 수 없어요");

    await slug.fill(next.toUpperCase());
    await save.click();
    await expect(page.getByRole("status")).toHaveText("저장했어요 ✓");
    expect((await page.goto(`/@${next}`))!.status()).toBe(200);
    expect((await page.goto(`/@${username}`))!.status()).toBe(404);
  });

  test("닉네임 규칙과 겹침", async ({ page, browser }) => {
    const other = await browser.newPage();
    const otherName = await signUpOk(other);

    await signUpOk(page);
    await page.goto("/settings/account");
    const nick = page.getByLabel("닉네임");
    const save = page.getByRole("button", { name: "저장" });
    await nick.fill("a");
    await save.click();
    await expect(page.locator("p[role=alert]")).toHaveText("닉네임은 2자 이상이에요");
    await nick.fill(otherName.toUpperCase());
    await save.click();
    await expect(page.locator("p[role=alert]")).toHaveText("이미 있는 닉네임이에요");
    await nick.fill(`창근${uid("").slice(0, 6)}`);
    await save.click();
    await expect(page.getByRole("status")).toHaveText("저장했어요 ✓");
  });
});
