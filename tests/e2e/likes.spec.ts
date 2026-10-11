import { expect, test, type Page } from "@playwright/test";
import { signUpOk, sql, writePost } from "./helpers";

// 공감 (SOC-03, specs/007-likes)
test.describe.configure({ timeout: 60_000 });

const like = (page: Page) => page.getByRole("button", { name: /공감 \d+$/ });

test.describe("SOC-03 공감", () => {
  test("누르면 ♥ 공감 1, 다시 누르면 취소, 카드의 ♥ N과 같다", async ({ page, browser }) => {
    const owner = await signUpOk(page);
    const id = await writePost(page, "공감 글", "본문");
    const g = await browser.newPage();
    await signUpOk(g);
    await g.goto(`/@${owner}/${id}`);
    await expect(like(g)).toHaveText("♡ 공감 0");
    await expect(like(g)).toHaveAttribute("aria-pressed", "false");

    await like(g).click();
    await expect(like(g)).toHaveText("♥ 공감 1");
    await expect(like(g)).toHaveAttribute("aria-pressed", "true");
    await expect(like(g)).toBeEnabled();
    await g.reload();
    await expect(like(g)).toHaveText("♥ 공감 1");
    await g.goto(`/@${owner}`);
    await expect(g.getByLabel("공감 1", { exact: true })).toBeVisible();

    await g.goto(`/@${owner}/${id}`);
    await like(g).click();
    await expect(like(g)).toHaveText("♡ 공감 0");
    await like(g).click();
    await expect(like(g)).toHaveText("♥ 공감 1");
    await expect(like(g)).toBeEnabled();
    await expect.poll(async () => (await sql`select 1 from post_likes where post_id = ${id}`).length).toBe(1);

    // 내 글에도 공감할 수 있고 수에 들어간다
    await page.goto(`/@${owner}/${id}`);
    await like(page).click();
    await expect(like(page)).toHaveText("♥ 공감 2");
  });

  test("다른 탭에서 이미 공감했으면 예전 화면에서 누를 때 취소된다", async ({ page }) => {
    const owner = await signUpOk(page);
    const id = await writePost(page, "탭 글", "본문");
    const tab2 = await page.context().newPage();
    await tab2.goto(`/@${owner}/${id}`);
    await page.goto(`/@${owner}/${id}`);
    await like(page).click();
    await expect(like(page)).toHaveText("♥ 공감 1");
    // 화면은 누르자마자 바뀌므로, 첫 탭의 공감이 서버에 저장될 때까지 기다린 뒤 둘째 탭을 누른다
    await expect(like(page)).toBeEnabled();
    await expect.poll(async () => (await sql`select 1 from post_likes where post_id = ${id}`).length).toBe(1);
    await expect(like(tab2)).toHaveText("♡ 공감 0");
    await like(tab2).click();
    await expect(like(tab2)).toHaveText("♡ 공감 0");
    await expect(like(tab2)).toBeEnabled();
    await expect.poll(async () => (await sql`select 1 from post_likes where post_id = ${id}`).length).toBe(0);
  });

  test("방문자는 비활성과 안내 글자, 볼 수 없는 글·이상한 ID는 저장 안 됨, 동시에 보내도 1개", async ({ page, browser }) => {
    const owner = await signUpOk(page);
    const id = await writePost(page, "공개", "본문");
    const secret = await writePost(page, "비밀", "본문", { private: true });
    const visitor = await browser.newPage();
    await visitor.goto(`/@${owner}/${id}`);
    await expect(like(visitor)).toBeDisabled();
    await expect(visitor.getByText("로그인하면 공감할 수 있어요")).toBeVisible();
    await expect(like(visitor)).toHaveAttribute("aria-describedby", "like-login");

    const g = await browser.newPage();
    await signUpOk(g);
    await g.goto(`/@${owner}/${id}`);
    let target = "";
    await g.route("**/*", async (route) => {
      const req = route.request();
      if (req.method() === "POST" && req.headers()["next-action"] && target) {
        return route.continue({ postData: req.postData()!.replace(`"${id}"`, JSON.stringify(target)) });
      }
      return route.continue();
    });
    for (const bad of [String(secret), "abc", "99999999999"]) {
      target = bad;
      const res = g.waitForResponse((r) => r.request().method() === "POST");
      await like(g).click();
      expect((await res).status()).toBe(200);
      await expect(like(g)).toHaveText("♡ 공감 0");
    }
    target = "";
    await g.unroute("**/*");
    expect(await sql`select 1 from post_likes where post_id in ${sql([id, secret])}`).toHaveLength(0);

    // 같은 공감 요청을 동시에 10번: 서버가 상태를 보고 정하므로 공감/취소가 번갈아도 행은 1개를 넘지 않는다
    const sent = g.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
    await like(g).click();
    const req = await sent;
    await expect(like(g)).toHaveText("♥ 공감 1");
    const results = await Promise.all(
      Array.from({ length: 10 }, () => g.request.post(req.url(), { headers: req.headers(), data: req.postData()! })),
    );
    expect(results.every((r) => r.status() === 200)).toBe(true);
    const rows = await sql`select 1 from post_likes where post_id = ${id}`;
    expect(rows.length).toBeLessThanOrEqual(1);
    // DB가 같은 공감을 두 번 받지 않는다
    const [{ id: uid }] = await sql`select id from users order by created_at desc limit 1`;
    await sql`insert into post_likes (post_id, user_id) values (${id}, ${uid}) on conflict do nothing`;
    await expect(sql`insert into post_likes (post_id, user_id) values (${id}, ${uid})`).rejects.toMatchObject({ code: "23505" });
  });

  test("글을 지우면 공감도 지워진다", async ({ page }) => {
    const owner = await signUpOk(page);
    const id = await writePost(page, "지울 글", "본문");
    await like(page).click();
    await expect(like(page)).toHaveText("♥ 공감 1");
    page.once("dialog", (d) => d.accept());
    await page.locator("footer").getByRole("button", { name: "삭제" }).click();
    await expect(page).toHaveURL(`/@${owner}`);
    expect(await sql`select 1 from post_likes where post_id = ${id}`).toHaveLength(0);
  });
});
