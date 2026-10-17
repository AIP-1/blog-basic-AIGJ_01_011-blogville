import { expect, test, type Page } from "./fixtures";
import { signUpOk } from "./helpers";

// 이번 주 글감 (plaza-upgrade-2 C1)과 발행 뒤 [🏮 광장에서 내 초롱 켜기] (C2)
test.describe.configure({ timeout: 90_000 });

async function writeFromPrompt(page: Page, title: string, opts: { private?: boolean } = {}) {
  await page.goto("/prompt");
  await page.locator("[data-prompt-write]").click();
  await expect(page).toHaveURL(/\/write\?topic=\d{4}-W\d\d$/);
  await page.getByLabel("제목", { exact: true }).fill(title);
  await page.getByLabel("본문").click();
  await page.keyboard.type("글감으로 쓴 본문이에요.");
  if (opts.private) await page.getByText("🔒 비공개").click();
  await page.getByRole("button", { name: "발행하기" }).click();
  await expect(page).toHaveURL(/\/@[a-z0-9_]+\/\d+$/);
}

test.describe("이번 주 글감", () => {
  test("/prompt에 주제·안내, [이 글감으로 쓰기]는 /write에 '글감'과 주제 태그를 채운다. 공개 글만 이웃의 답장에", async ({ page }) => {
    await signUpOk(page);
    await page.goto("/prompt");
    await expect(page).toHaveTitle("이번 주 글감 | Blogville");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("📝 이번 주 글감");
    const board = page.locator("[data-prompt]");
    const key = (await board.getAttribute("data-prompt"))!;
    expect(key).toMatch(/^\d{4}-W\d\d$/);
    const topic = (await page.locator("#prompt-title").textContent())!;
    expect(topic.length).toBeGreaterThan(0);
    await expect(page.locator("#prompt-answers")).toContainText("이웃의 답장");
    // 광장 게시판 앞으로 돌아간다
    await expect(page.locator("[data-room-exit]")).toHaveAttribute("href", "/town?from=prompt");

    await page.locator("[data-prompt-write]").click();
    await expect(page).toHaveURL(`/write?topic=${key}`);
    await expect(page.locator(`[data-write-topic="${key}"]`)).toContainText(`이번 주 글감: ${topic}`);
    const tags = await page.getByLabel("태그").inputValue();
    expect(tags.split(",").map((t) => t.trim())[0]).toBe("글감");
    const tag = tags.split(",").map((t) => t.trim())[1];
    expect(tag.length).toBeGreaterThan(0);

    const open = `글감 공개 ${Date.now()}`;
    const hidden = `글감 비공개 ${Date.now()}`;
    await writeFromPrompt(page, open);
    // C2: 발행 안내 옆 [🏮 광장에서 내 초롱 켜기], 안내 글자는 그대로
    await expect(page.getByRole("status").filter({ hasText: "글을 발행했어요" })).toHaveText(/^🎉 글을 발행했어요! /);
    await expect(page.locator("[data-publish-lantern]")).toHaveText("🏮 광장에서 내 초롱 켜기");
    await expect(page.locator("[data-publish-lantern]")).toHaveAttribute("href", "/town?from=home&lit=1");
    await writeFromPrompt(page, hidden, { private: true });

    await page.goto("/prompt");
    const answers = page.locator("[data-prompt-answer]");
    await expect(answers.filter({ hasText: open })).toHaveCount(1);
    await expect(answers.filter({ hasText: hidden })).toHaveCount(0);
    await expect(answers.filter({ hasText: open }).getByRole("link")).toHaveAttribute("href", /^\/@[a-z0-9_]+\/\d+$/);
  });

  test("지난 글감은 ?week=로, 모르는 주·앞으로 올 주는 이번 주. 방문자도 볼 수 있다", async ({ page, browser }) => {
    await signUpOk(page);
    await page.goto("/prompt");
    const key = (await page.locator("[data-prompt]").getAttribute("data-prompt"))!;
    await page.getByRole("link", { name: "‹ 지난주" }).click();
    await expect(page).toHaveURL(/\/prompt\?week=\d{4}-W\d\d$/);
    await expect(page.locator("[data-prompt]")).not.toHaveAttribute("data-prompt", key);
    await expect(page.locator("[data-prompt-write]")).toHaveCount(0);
    await page.getByRole("link", { name: "다음 주 ›" }).click();
    await expect(page).toHaveURL("/prompt");
    await page.goto("/prompt?week=2099-W01");
    await expect(page.locator("[data-prompt]")).toHaveAttribute("data-prompt", key);
    await page.goto("/prompt?week=nope");
    await expect(page.locator("[data-prompt]")).toHaveAttribute("data-prompt", key);

    const guest = await browser.newPage();
    await guest.goto("/prompt");
    await expect(guest.locator("[data-prompt]")).toHaveAttribute("data-prompt", key);
    await expect(guest.getByText("글은 로그인하면 쓸 수 있어요.")).toBeVisible();
    await guest.close();
  });

  // A(게시판 세 번째 입구)·B(from=home·celebrate)와 합친 뒤 켠다
  test.fixme("합친 뒤: 게시판 '글감' 입구 Space → /prompt, [내 초롱 켜기] → 내 집 앞에서 축하, 다시 열면 축하 없음", async ({ page }) => {
    await signUpOk(page);
    await page.goto("/write");
    await page.getByLabel("제목", { exact: true }).fill("초롱 켜기 글");
    await page.getByLabel("본문").click();
    await page.keyboard.type("오늘 글이에요. 초롱이 켜질까요?");
    await page.getByRole("button", { name: "발행하기" }).click();
    await page.locator("[data-publish-lantern]").click();
    await expect(page).toHaveURL("/town?from=home&lit=1");
    const canvas = page.locator("[data-town] canvas");
    await expect(canvas).toHaveAttribute("data-ready", "1");
    await expect(canvas).toHaveAttribute("data-celebrate", "1");
    await expect(page.locator("[data-town]")).toContainText("이웃");
    await page.reload();
    await expect(canvas).toHaveAttribute("data-celebrate", "0");
  });
});
