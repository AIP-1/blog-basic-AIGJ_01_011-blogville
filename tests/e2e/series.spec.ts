import { expect, test, type Page } from "./fixtures";
import { signUpOk, sql } from "./helpers";

// 시리즈 (개선 12)
async function write(page: Page, title: string, series: { pick?: string; create?: string }, opts: { private?: boolean } = {}) {
  await page.goto("/write");
  await page.getByLabel("제목", { exact: true }).fill(title);
  if (series.create) {
    await page.getByLabel("시리즈", { exact: true }).selectOption("new");
    await page.getByLabel("새 시리즈 이름").fill(series.create);
  } else if (series.pick) {
    await page.getByLabel("시리즈", { exact: true }).selectOption({ label: `📚 ${series.pick}` });
  }
  await page.getByLabel("본문").click();
  await page.keyboard.type("본문");
  if (opts.private) await page.getByText("🔒 비공개").click();
  await page.getByRole("button", { name: "발행하기" }).click();
  await expect(page).toHaveURL(/\/@[a-z0-9_]+\/\d+(\?new=1)?$/);
  return Number(new URL(page.url()).pathname.split("/").pop());
}

test("시리즈를 만들어 글을 묶고, 글 위 상자에서 순서·이전 편·다음 편으로 오간다", async ({ page, browser }) => {
  const username = await signUpOk(page);
  const first = await write(page, "1편 출발", { create: "제주 여행" });
  const secret = await write(page, "비밀 편", { pick: "제주 여행" }, { private: true });
  const third = await write(page, "3편 도착", { pick: "제주 여행" });
  await write(page, "다른 글", {});

  // 주인은 비공개 편까지 3개
  await page.goto(`/@${username}/${third}`);
  const box = page.locator("[data-series]");
  await expect(box).toContainText("제주 여행");
  await expect(box.locator("[data-series-position]")).toHaveText("3/3 ▾");
  await expect(box.locator("[data-series-next]")).toHaveCount(0);
  await box.locator("[data-series-prev]").click();
  await expect(page).toHaveURL(`/@${username}/${secret}`);

  // 남에게는 비공개 편이 빠진다
  const visitor = await browser.newPage();
  await visitor.goto(`/@${username}/${first}`);
  const vbox = visitor.locator("[data-series]");
  await expect(vbox.locator("[data-series-position]")).toHaveText("1/2 ▾");
  await vbox.locator("summary").click();
  await expect(vbox.getByRole("link")).toHaveText(["1\n1편 출발", "2\n3편 도착", "다음 편: 3편 도착 →"].map((t) => new RegExp(t.replace("\n", "\\s*"))));
  await vbox.locator("[data-series-next]").click();
  await expect(visitor).toHaveURL(`/@${username}/${third}`);

  // 시리즈가 없는 글에는 상자가 없다
  await visitor.goto(`/@${username}`);
  await visitor.locator("[data-post-list] a, article a").filter({ hasText: "다른 글" }).first().click();
  await expect(visitor.locator("[data-series]")).toHaveCount(0);

  // 수정 화면에 시리즈가 골라져 있고, 모두 빼면 시리즈가 지워진다
  for (const id of [first, secret, third]) {
    await page.goto(`/write/${id}`);
    await expect(page.getByLabel("시리즈", { exact: true })).not.toHaveValue("");
    await page.getByLabel("시리즈", { exact: true }).selectOption("");
    await page.getByRole("button", { name: "수정 완료" }).click();
    await expect(page).toHaveURL(`/@${username}/${id}`);
  }
  const [{ n }] = await sql`select count(*)::int as n from series s join blogs b on b.id = s.blog_id where b.slug = ${username}`;
  expect(n).toBe(0);
});

test("새 시리즈 이름을 비우면 문구, 남의 시리즈 번호는 저장 안 됨", async ({ page, browser }) => {
  const other = await browser.newPage();
  const otherName = await signUpOk(other);
  await write(other, "남의 글", { create: "남의 시리즈" });
  const [{ id: foreign }] = await sql`select s.id from series s join blogs b on b.id = s.blog_id where b.slug = ${otherName}`;

  await signUpOk(page);
  await page.goto("/write");
  await page.getByLabel("제목", { exact: true }).fill("글");
  await page.getByLabel("시리즈", { exact: true }).selectOption("new");
  await page.getByLabel("본문").click();
  await page.keyboard.type("본문");
  await page.getByRole("button", { name: "발행하기" }).click();
  await expect(page.locator(".form-error")).toHaveText("새 시리즈 이름을 적어 주세요");

  // 남의 시리즈 번호로 바꿔 보낸다
  let tampered = false;
  await page.getByLabel("새 시리즈 이름").fill("내 시리즈");
  await page.route("**/write", async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !/name="[^"]*seriesId"\r\n\r\nnew/.test(body)) return route.continue();
    tampered = true;
    await route.continue({ postData: body.replace(/(name="[^"]*seriesId"\r\n\r\n)new/, `$1${foreign}`) });
  });
  await page.getByRole("button", { name: "발행하기" }).click();
  await expect(page.locator(".form-error")).toHaveText("잘못된 요청이에요");
  expect(tampered).toBe(true);
});
