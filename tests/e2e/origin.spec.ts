import { expect, test, type Page } from "@playwright/test";
import { signUpOk, sql, writePost } from "./helpers";

type Captured = { url: string; headers: Record<string, string>; body: Buffer };

/** 화면에서 보낸 Server Action 요청을 막고 그대로 담아 둔다 */
async function capture(page: Page, submit: () => Promise<void>): Promise<Captured> {
  let resolve!: (c: Captured) => void;
  const done = new Promise<Captured>((r) => (resolve = r));
  await page.route("**/*", async (route) => {
    const req = route.request();
    if (req.method() !== "POST" || !req.headers()["next-action"]) return route.continue();
    resolve({ url: req.url(), headers: await req.allHeaders(), body: req.postDataBuffer() ?? Buffer.alloc(0) });
    return route.abort();
  });
  await submit();
  const captured = await done;
  await page.unroute("**/*");
  return captured;
}

/** 담아 둔 요청을 Origin만 바꿔 다시 보낸다 (쿠키는 같은 브라우저 것) */
function replay(page: Page, c: Captured, origin: string) {
  const headers: Record<string, string> = { ...c.headers, origin };
  delete headers["content-length"];
  delete headers["cookie"];
  return page.request.fetch(c.url, { method: "POST", headers, data: c.body, maxRedirects: 0 });
}

// NF-12, SC-005: 다른 사이트에서 보낸 쓰기 요청은 거부된다.
// 같은 요청을 원래 Origin으로 보내면 반영되는지도 확인해 시험이 헛돌지 않게 한다.
test("다른 Origin에서 온 글 저장·삭제·카테고리 추가는 반영되지 않는다", async ({ page, baseURL }) => {
  const username = await signUpOk(page);
  const id = await writePost(page, "지키는 글", "본문");
  const [blog] = await sql`select b.id from blogs b join users u on u.id = b.owner_id where u.username = ${username}`;
  const titles = async () => (await sql`select title from posts where blog_id = ${blog.id} order by id`).map((p) => p.title);
  const hasCategory = async () => (await sql`select 1 from categories where blog_id = ${blog.id} and name = '몰래'`).length > 0;

  await page.goto("/write");
  await page.getByLabel("제목", { exact: true }).fill("몰래 쓴 글");
  await page.getByLabel("본문").click();
  await page.keyboard.type("본문");
  const save = await capture(page, () => page.getByRole("button", { name: "발행하기" }).click());

  await page.goto(`/@${username}/${id}`);
  page.once("dialog", (d) => d.accept());
  const del = await capture(page, () => page.getByRole("button", { name: "삭제" }).click());

  await page.goto("/settings/blog");
  await page.getByLabel("새 카테고리 이름").fill("몰래");
  const add = await capture(page, () => page.getByRole("button", { name: "추가", exact: true }).click());

  for (const c of [save, del, add]) {
    expect((await replay(page, c, "https://evil.example")).status()).toBeGreaterThanOrEqual(400);
  }
  expect(await titles()).toEqual(["지키는 글"]);
  expect(await hasCategory()).toBe(false);

  for (const c of [save, add]) expect((await replay(page, c, baseURL!)).status()).toBeLessThan(400);
  expect(await titles()).toEqual(["지키는 글", "몰래 쓴 글"]);
  expect(await hasCategory()).toBe(true);
  await replay(page, del, baseURL!);
  expect(await titles()).toEqual(["몰래 쓴 글"]);
});
