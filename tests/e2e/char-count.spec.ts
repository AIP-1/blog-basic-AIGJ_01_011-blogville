import { expect, test } from "./fixtures";
import { signUpOk, sql } from "./helpers";

// 글쓰기 아래 `N자` (POST-01 글자 수, 게임 보상 문구는 뺌), specs/028-char-count
test.describe.configure({ timeout: 60_000 });

test.describe("POST-01 글자 수", () => {
  test("쓰는 대로 N자가 바뀌고(문단 줄바꿈·이모지·천 단위 쉼표), 발행한 본문 글자 수와 같다, 고칠 때는 `· 글을 고치고 있어요`", async ({ page }) => {
    await signUpOk(page);
    await page.goto("/write");
    const count = page.locator("[data-char-count]");
    await expect(count).toHaveText("0자");
    await page.getByLabel("제목", { exact: true }).fill("글자 수 글");
    await page.getByLabel("본문").click();
    await page.keyboard.type("안녕 😀");
    await expect(count).toHaveText("5자"); // 😀는 2자
    await page.keyboard.press("Enter");
    await page.keyboard.type("둘째   문단  ");
    // 줄바꿈 1자, 끝 공백은 세지 않는다: "안녕 😀\n둘째   문단"
    await expect(count).toHaveText(`${"안녕 😀\n둘째   문단".length}자`);
    await page.keyboard.press("Enter");
    await page.keyboard.insertText("가".repeat(1000));
    // 붙여 넣은 1000자가 반영될 때까지 기다린 뒤 읽는다
    await expect(count).toHaveText(/^1,0\d\d자$/);
    const shown = Number((await count.textContent())!.replace(/[^0-9]/g, ""));
    expect(shown).toBe("안녕 😀\n둘째   문단".length + 1 + 1000);

    await page.getByRole("button", { name: "발행하기" }).click();
    await expect(page).toHaveURL(/\/@[a-z0-9_]+\/\d+$/);
    const id = Number(page.url().split("/").pop());
    const [row] = await sql`select char_length(content_text) as n, content_text from posts where id = ${id}`;
    // DB char_length는 코드 포인트 수라 😀(JS 2자)를 1자로 센다
    expect(Number(row.n) + 1).toBe(shown);

    await page.goto(`/write/${id}`);
    // 저장된 글을 에디터가 다시 읽을 때 이어진 띄어쓰기를 하나로 합칠 수 있어(HTML 규칙) 숫자는 범위로 본다
    await expect(count).toHaveText(/^1,01\d자 · 글을 고치고 있어요$/);
    await sql`update posts set created_at = '2001-01-01' where id = ${id}`;
  });
});
