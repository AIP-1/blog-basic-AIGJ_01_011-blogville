import { expect, test, type Page } from "@playwright/test";
import { signUpOk, writePost } from "./helpers";

async function addCategory(page: Page, name: string) {
  await page.getByLabel("새 카테고리 이름").fill(name);
  await page.getByLabel("새 카테고리 이름").press("Enter");
}

const row = (page: Page, name: string) =>
  page.locator("div").filter({ has: page.getByText(name, { exact: true }) }).filter({ has: page.getByRole("button", { name: "이름 바꾸기" }) }).last();

test.describe("US4 카테고리 2단계", () => {
  test("추가·소분류·문구·순서", async ({ page }) => {
    await signUpOk(page);
    await page.goto("/settings/blog");
    await addCategory(page, "여행");
    await expect(row(page, "여행")).toBeVisible();

    await addCategory(page, "여행");
    await expect(page.locator("p[role=alert]")).toHaveText("이미 있는 카테고리예요");
    await expect(page.getByLabel("새 카테고리 이름")).toHaveValue("여행");
    await addCategory(page, "가".repeat(20));
    await expect(row(page, "가".repeat(20))).toBeVisible();
    await addCategory(page, "   ");
    await expect(page.locator("p[role=alert]")).toHaveText("카테고리 이름을 적어 주세요");

    // 일상, 여행, 가×20 → 여행을 위로
    await row(page, "여행").getByRole("button", { name: "여행 위로" }).click();
    await expect(page.locator("li > div span.font-semibold")).toHaveText(["여행", "일상", "가".repeat(20)]);
    await expect(page.getByRole("button", { name: "여행 위로" })).toBeDisabled();

    await row(page, "여행").getByRole("button", { name: "소분류 추가" }).click();
    await page.getByLabel("소분류 이름").fill("맛집");
    await page.getByLabel("소분류 이름").press("Enter");
    await expect(row(page, "맛집")).toBeVisible();
  });

  test("글에 붙이고 배지·필터, 소분류·대분류를 지우면 글은 남는다", async ({ page }) => {
    const username = await signUpOk(page);
    await page.goto("/settings/blog");
    await addCategory(page, "여행");
    await row(page, "여행").getByRole("button", { name: "소분류 추가" }).click();
    await page.getByLabel("소분류 이름").fill("맛집");
    await page.getByLabel("소분류 이름").press("Enter");
    await expect(row(page, "맛집")).toBeVisible();

    const id = await writePost(page, "부산 여행", "돼지국밥", { category: "여행", sub: "맛집" });
    await expect(page.getByRole("link", { name: "여행 › 맛집" })).toBeVisible();
    await writePost(page, "일상 글", "평범한 하루", { category: "일상" });

    await page.goto(`/@${username}`);
    await page.getByRole("navigation", { name: "카테고리" }).getByRole("link", { name: /맛집/ }).last().click();
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(page.getByRole("article")).toContainText("부산 여행");

    await page.goto("/settings/blog");
    page.once("dialog", (d) => {
      expect(d.message()).toBe("'맛집' 소분류를 지울까요? 글은 '여행'에 남아요.");
      void d.accept();
    });
    await row(page, "맛집").getByRole("button", { name: "삭제" }).click();
    await expect(row(page, "맛집")).toHaveCount(0);
    await page.goto(`/@${username}/${id}`);
    await expect(page.getByRole("link", { name: "여행", exact: true })).toBeVisible();

    await page.goto("/settings/blog");
    page.once("dialog", (d) => void d.accept());
    await row(page, "여행").getByRole("button", { name: "삭제" }).click();
    await expect(row(page, "여행")).toHaveCount(0);
    await page.goto(`/@${username}/${id}`);
    await expect(page.getByRole("heading", { name: "부산 여행" })).toBeVisible();
    await expect(page.getByRole("link", { name: /여행/ })).toHaveCount(0);
  });

  test("글쓰기: 대분류를 고르면 소분류가 켜지고, 바꾸면 풀린다", async ({ page }) => {
    await signUpOk(page);
    await page.goto("/settings/blog");
    await addCategory(page, "여행");
    await row(page, "여행").getByRole("button", { name: "소분류 추가" }).click();
    await page.getByLabel("소분류 이름").fill("맛집");
    await page.getByLabel("소분류 이름").press("Enter");
    await expect(row(page, "맛집")).toBeVisible();

    await page.goto("/write");
    await expect(page.getByLabel("소분류")).toBeDisabled();
    await page.getByLabel("대분류").selectOption({ label: "여행" });
    await page.getByLabel("소분류").selectOption({ label: "맛집" });
    await page.getByLabel("대분류").selectOption({ label: "일상" });
    await expect(page.getByLabel("소분류")).toHaveValue("");
  });
});
