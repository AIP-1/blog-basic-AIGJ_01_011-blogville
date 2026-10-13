import { expect, test } from "./fixtures";
import { signUpOk } from "./helpers";

// 에디터 보강: 표·YouTube·문단 정렬 (개선 9)
test("표를 넣고 줄을 더하고, YouTube 영상과 가운데 정렬 문단을 넣어 발행하면 글에 그대로 보인다", async ({ page }) => {
  await signUpOk(page);
  await page.goto("/write");
  await page.getByLabel("제목", { exact: true }).fill("표와 영상");
  const body = page.getByLabel("본문");
  await body.click();
  await page.keyboard.type("가운데 글");
  await page.getByRole("button", { name: "가운데 정렬" }).click();
  await expect(page.getByRole("button", { name: "가운데 정렬" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "왼쪽 정렬" }).click();

  await page.getByRole("button", { name: "표 넣기" }).click();
  const tools = page.locator("[data-table-tools]");
  await expect(tools).toBeVisible();
  await page.keyboard.type("이름");
  await page.keyboard.press("Tab");
  await page.keyboard.type("값");
  await tools.getByRole("button", { name: "줄 더하기" }).click();
  await expect(page.locator(".tiptap table tr")).toHaveCount(4);

  // 창이 뜨는 순서대로 답한다: 이상한 주소 → 알림 → 맞는 주소
  const answers = ["https://evil.com/watch?v=dQw4w9WgXcQ", "", "https://youtu.be/dQw4w9WgXcQ"];
  const messages: string[] = [];
  page.on("dialog", (d) => {
    messages.push(d.message());
    void (d.type() === "prompt" ? d.accept(answers.shift()) : (answers.shift(), d.accept()));
  });
  await page.getByRole("button", { name: "YouTube 영상" }).click();
  await expect.poll(() => messages.length).toBe(2);
  expect(messages[1]).toContain("YouTube 영상 주소를 넣어 주세요");
  await expect(page.locator(".tiptap iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "YouTube 영상" }).click();
  await expect(page.locator(".tiptap div[data-youtube-video] iframe")).toHaveCount(1);

  await page.getByRole("button", { name: "발행하기" }).click();
  await expect(page).toHaveURL(/\/@[a-z0-9_]+\/\d+(\?new=1)?$/);
  const post = page.locator(".prose-post").first();
  await expect(post.locator("p", { hasText: "가운데 글" })).toHaveCSS("text-align", "center");
  await expect(post.locator("table tr")).toHaveCount(4);
  await expect(post.locator("th").first()).toHaveText("이름");
  await expect(post.locator("div[data-youtube-video] iframe")).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
});
