import { expect, test, type Page } from "@playwright/test";
import { signUpOk, sql, uid } from "./helpers";

// 인기 태그 비교는 다른 시험이 태그를 쓰는 동안 다시 읽으므로 기본 30초로는 모자랄 때가 있다
test.describe.configure({ timeout: 60_000 });

async function postWithTags(page: Page, title: string, tags: string, opts: { private?: boolean } = {}) {
  await page.goto("/write");
  await page.getByLabel("제목", { exact: true }).fill(title);
  await page.getByLabel("본문").click();
  await page.keyboard.type("본문");
  await page.getByLabel("태그").fill(tags);
  if (opts.private) await page.getByText("🔒 비공개").click();
  await page.getByRole("button", { name: "발행하기" }).click();
  await expect(page).toHaveURL(/\/@[a-z0-9_]+\/\d+$/);
  return Number(page.url().split("/").pop());
}

const badges = (page: Page) => page.getByRole("list", { name: "태그" }).getByRole("link");

test.describe("US1 글에 태그 달기", () => {
  test("Git·#회고·git → 두 개, 이름순 배지, 수정 화면 채우기, 비우면 없어짐", async ({ page }) => {
    const username = await signUpOk(page);
    const t = uid("g");
    const id = await postWithTags(page, "태그 글", `${t.toUpperCase()}, #회고, ${t}`);
    await expect(badges(page)).toHaveText([`#${t}`, "#회고"]);
    await expect(badges(page).first()).toHaveAttribute("href", `/tags/${t}`);

    await page.goto(`/write/${id}`);
    await expect(page.getByLabel("태그")).toHaveValue(`${t}, 회고`);
    await page.getByLabel("태그").fill("회고");
    await page.getByRole("button", { name: "수정 완료" }).click();
    await expect(page).toHaveURL(`/@${username}/${id}`);
    await expect(badges(page)).toHaveText(["#회고"]);

    await page.goto(`/write/${id}`);
    await page.getByLabel("태그").fill("");
    await page.getByRole("button", { name: "수정 완료" }).click();
    await expect(page).toHaveURL(`/@${username}/${id}`);
    await expect(page.getByRole("list", { name: "태그" })).toHaveCount(0);
    expect(await sql`select 1 from post_tags where post_id = ${id}`).toHaveLength(0);
  });

  test("21자·11번째는 조용히 빠지고, 칸은 300자에서 멈춘다", async ({ page }) => {
    await signUpOk(page);
    const names = Array.from({ length: 11 }, (_, i) => `n${i}`);
    const id = await postWithTags(page, "많은 태그", ["가".repeat(21), ...names].join(","));
    const saved = (await sql`select t.name from post_tags pt join tags t on t.id = pt.tag_id where pt.post_id = ${id} order by t.name`).map((r) => r.name);
    expect(saved).toEqual(names.slice(0, 10).sort());
    await page.goto("/write");
    await page.getByLabel("태그").fill("a".repeat(310));
    await expect(page.getByLabel("태그")).toHaveValue("a".repeat(300));
  });

  test("300자를 넘겨 조작해 보내면 문구가 나오고 저장되지 않는다", async ({ page }) => {
    await signUpOk(page);
    await page.goto("/write");
    await page.getByLabel("제목", { exact: true }).fill("조작");
    await page.getByLabel("본문").click();
    await page.keyboard.type("본문");
    await page.getByLabel("태그").evaluate((el: HTMLInputElement) => el.removeAttribute("maxlength"));
    await page.getByLabel("태그").fill("a".repeat(301));
    await page.getByRole("button", { name: "발행하기" }).click();
    await expect(page.locator("p[role=alert]")).toHaveText("태그는 모두 합쳐 300자까지예요");
    await expect(page).toHaveURL("/write");
  });
});

test.describe("US2 태그별 글", () => {
  test("공개 글만, 블로그 이름과 함께, 인기 태그에도 공개 글만", async ({ page, browser }) => {
    await signUpOk(page);
    const t = uid("p");
    const secret = uid("s");
    await postWithTags(page, "공개 하나", t);
    await postWithTags(page, "공개 둘", `${t}, 둘째`);
    await postWithTags(page, "비공개", `${t}, ${secret}`, { private: true });

    const visitor = await browser.newPage();
    await visitor.goto(`/tags/${t}`);
    await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(`🏷 #${t}`);
    await expect(visitor).toHaveTitle(`#${t} | Blogville`);
    await expect(visitor.getByRole("article")).toHaveCount(2);
    await expect(visitor.getByRole("article").first()).toContainText("공개 둘");
    await expect(visitor.getByRole("article").first()).toContainText("의 블로그 ·");
    await expect(visitor.getByText("비공개")).toHaveCount(0);

    // 시험 DB에는 다른 시험의 태그도 쌓이므로, 화면의 인기 태그를 같은 규칙의 SQL 결과와 맞춰 본다.
    // 다른 시험이 동시에 글을 쓰면 둘 사이가 달라질 수 있어 맞을 때까지 다시 읽는다.
    await expect(async () => {
      await visitor.reload();
      const expected = await sql`select t.name, count(*)::int as n from tags t
        join post_tags pt on pt.tag_id = t.id join posts p on p.id = pt.post_id and p.is_public
        group by t.id order by count(*) desc, t.name limit 30`;
      const shown = await visitor.getByRole("region", { name: "🏷 인기 태그" }).getByRole("link").allInnerTexts();
      expect(shown.map((x) => x.replace(/\s+/g, " "))).toEqual(expected.map((r) => `#${r.name} ${r.n}`));
      expect(shown.some((x) => x.startsWith(`#${secret}`))).toBe(false);
    }).toPass({ timeout: 20_000 });

    await visitor.getByRole("article").first().getByRole("link").click();
    await expect(visitor.getByRole("heading", { name: "공개 둘" })).toBeVisible();
    await visitor.close();
  });

  test("글이 없는 태그는 빈 목록, %가 든 태그도 목록과 탭 제목이 맞다, 페이지 넘기기", async ({ page }) => {
    await page.goto(`/tags/${uid("none")}`);
    await expect(page.getByText("이 태그가 달린 글이 없어요.")).toBeVisible();

    await signUpOk(page);
    const pct = `${uid("c").slice(0, 10)}100%`;
    await postWithTags(page, "퍼센트", pct);
    await page.getByRole("list", { name: "태그" }).getByRole("link").click();
    await expect(page).toHaveURL(`/tags/${encodeURIComponent(pct)}`);
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(page).toHaveTitle(`#${pct} | Blogville`);

    const many = uid("m");
    const [row] = await sql`select id from posts where title = '퍼센트' order by id desc limit 1`;
    const [{ blog_id }] = await sql`select blog_id from posts where id = ${row.id}`;
    const [tag] = await sql`insert into tags (name) values (${many}) returning id`;
    for (let i = 1; i <= 9; i++) {
      const [p] = await sql`insert into posts (blog_id, title, content_html, content_text, created_at)
        values (${blog_id}, ${"페이지 " + i}, '<p>x</p>', 'x', now() - make_interval(mins => ${10 - i})) returning id`;
      await sql`insert into post_tags (post_id, tag_id) values (${p.id}, ${tag.id})`;
    }
    await page.goto(`/tags/${many}`);
    await expect(page.getByRole("article")).toHaveCount(8);
    await page.getByRole("navigation", { name: "페이지" }).getByRole("link", { name: "2" }).click();
    await expect(page).toHaveURL(`/tags/${many}?page=2`);
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(page.getByRole("article")).toContainText("페이지 1");
    await page.goto(`/tags/${many}?page=abc`);
    await expect(page.getByRole("article")).toHaveCount(8);
  });

  test("375px에서 배지·칩 높이 44px 이상, 가로 스크롤 없음", async ({ page }) => {
    await signUpOk(page);
    const t = uid("w");
    await postWithTags(page, "모바일", `${t}, 아주아주긴태그이름이에요스무자`);
    await page.setViewportSize({ width: 375, height: 812 });
    for (const link of await badges(page).all()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.goto(`/tags/${t}`);
    const chip = page.getByRole("region", { name: "🏷 인기 태그" }).getByRole("link").first();
    expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});
