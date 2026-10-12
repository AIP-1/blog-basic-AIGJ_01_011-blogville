import { expect, test, type Page } from "@playwright/test";
import { signUpOk, sql, writePost } from "./helpers";

// 새 글 발행 직후 글 상세 맨 위 `🎉 글을 발행했어요!` (POST-01 발행 안내, 게임 보상 없는 부분), specs/022-publish-notice
test.describe.configure({ timeout: 60_000 });

const notice = (page: Page) => page.getByRole("status").filter({ hasText: "글을 발행했어요" });

test.describe("POST-01 발행 안내", () => {
  test("새 글을 발행하면 맨 위 노란 안내, 주소의 ?new는 지워지고 새로고침하면 사라진다, 고친 뒤에는 없다", async ({ page }) => {
    const username = await signUpOk(page);
    const id = await writePost(page, "발행 안내 글", "본문");
    await expect(notice(page)).toHaveText(/^🎉 글을 발행했어요! /);
    await expect(notice(page)).toHaveCSS("background-color", "rgb(255, 248, 225)");
    // 글보다 위에 있다
    const top = (await notice(page).boundingBox())!.y;
    expect(top).toBeLessThan((await page.getByRole("heading", { level: 1, name: "발행 안내 글" }).boundingBox())!.y);
    await expect(page).toHaveURL(`/@${username}/${id}`);

    // 화면 안 링크로 옮겼다가 뒤로·앞으로 가도 (Next가 저장해 둔 화면을 다시 꺼내도) 다시 안 보인다
    await page.getByRole("link", { name: "목록으로" }).click();
    await expect(page).toHaveURL(`/@${username}`);
    await page.goBack();
    await expect(page).toHaveURL(`/@${username}/${id}`);
    await expect(page.getByRole("heading", { level: 1, name: "발행 안내 글" })).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL("/write");
    await page.goForward();
    await expect(page).toHaveURL(`/@${username}/${id}`);
    await expect(page.getByRole("heading", { level: 1, name: "발행 안내 글" })).toBeVisible();
    await expect(notice(page)).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "발행 안내 글" })).toBeVisible();
    await expect(notice(page)).toHaveCount(0);

    // 고친 뒤에는 안내 없이 글로 돌아간다
    await page.goto(`/write/${id}`);
    await page.getByLabel("제목", { exact: true }).fill("고친 발행 안내 글");
    await page.getByRole("button", { name: "수정 완료" }).click();
    await expect(page).toHaveURL(`/@${username}/${id}`);
    await expect(page.getByRole("heading", { level: 1, name: "고친 발행 안내 글" })).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
  });

  test("다른 회원·방문자가 ?new=1 주소를 열거나, 만든 지 10분이 지났으면 안내가 없다", async ({ page, browser }) => {
    const username = await signUpOk(page);
    const id = await writePost(page, "남이 여는 글", "본문");
    await expect(notice(page)).toBeVisible();

    const other = await browser.newPage();
    await signUpOk(other);
    await other.goto(`/@${username}/${id}?new=1`);
    await expect(other.getByRole("heading", { level: 1, name: "남이 여는 글" })).toBeVisible();
    await expect(notice(other)).toHaveCount(0);
    const visitor = await browser.newPage();
    await visitor.goto(`/@${username}/${id}?new=1`);
    await expect(visitor.getByRole("heading", { level: 1, name: "남이 여는 글" })).toBeVisible();
    await expect(notice(visitor)).toHaveCount(0);

    // 10분 안이면 주인이 다시 열어도 보인다 (명세 열린 질문대로 둔다), 10분이 지나면 없다
    await page.goto(`/@${username}/${id}?new=1`);
    await expect(notice(page)).toBeVisible();
    await expect(page).toHaveURL(`/@${username}/${id}`);
    // 처음 열 때 지운 주소도 Next 기록과 맞아, 다른 화면에 갔다가 뒤로 오면 그 글이 다시 그려진다
    await page.getByRole("link", { name: "목록으로" }).click();
    await expect(page).toHaveURL(`/@${username}`);
    await page.goBack();
    await expect(page).toHaveURL(`/@${username}/${id}`);
    await expect(page.getByRole("heading", { level: 1, name: "남이 여는 글" })).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
    await sql`update posts set created_at = now() - interval '11 minutes' where id = ${id}`;
    await page.goto(`/@${username}/${id}?new=1`);
    await expect(page.getByRole("heading", { level: 1, name: "남이 여는 글" })).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
    await sql`update posts set created_at = '2001-01-01' where id = ${id}`;
  });
});
