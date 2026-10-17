import { expect, test, type Page } from "./fixtures";
import { sql, uid } from "./helpers";

// 🔥 인기 글: 기간(오늘·이번 주·이번 달)별 점수 순 (조회 + 공감 ×3 + 댓글 ×2), 같으면 새 글 먼저
test.describe.configure({ timeout: 90_000 });

const kstDay = (daysAgo: number) => sql`((now() at time zone 'Asia/Seoul')::date - ${daysAgo}::int)`;

/** 글을 넣고 번호를 돌려준다. ago: 며칠 전에 쓴 글인지 */
async function addPost(username: string, title: string, ago: number, opts: { isPublic?: boolean; blinded?: boolean; scheduled?: boolean } = {}) {
  const [row] = await sql`insert into posts (blog_id, title, content_html, content_text, is_public, blinded_at, blind_reason, publish_at, created_at)
    select b.id, ${title}, '<p>본문</p>', '본문', ${opts.isPublic ?? true},
      ${opts.blinded ? sql`now()` : null}, ${opts.blinded ? "시험 블라인드" : null},
      ${opts.scheduled ? sql`now() + interval '3 days'` : null},
      now() - make_interval(days => ${ago})
    from blogs b join users u on u.id = b.owner_id where u.username = ${username} returning id`;
  return row.id as number;
}

/** 그 글을 ago일 전(한국 날짜)에 본 방문자 n명 */
async function addViews(postId: number, n: number, ago: number) {
  await sql`insert into post_views (post_id, date, visitor_id) select ${postId}, ${kstDay(ago)}, gen_random_uuid() from generate_series(1, ${n})`;
}

async function addLikes(postId: number, n: number, ago: number) {
  await sql`insert into post_likes (post_id, user_id, created_at)
    select ${postId}, id, now() - make_interval(days => ${ago}) from users order by created_at limit ${n}`;
}

async function addComments(postId: number, n: number, ago: number, deleted = false) {
  await sql`insert into comments (post_id, content, deleted_at, created_at)
    select ${postId}, ${deleted ? "" : "좋아요"}, ${deleted ? sql`now()` : null}, now() - make_interval(days => ${ago}) from generate_series(1, ${n})`;
}

/** 화면의 인기 글 번호 순서 */
const ranked = (page: Page) =>
  page.locator("[data-popular-post]").evaluateAll((els) => els.map((el) => Number(el.getAttribute("data-popular-post"))));

test.describe("🔥 인기 글", () => {
  test("점수 순·같으면 새 글 먼저, 비공개·블라인드·예약 글은 빠지고, 오늘·이번 주·이번 달 탭이 바뀐다", async ({ page }) => {
    // 화면으로 가입하지 않고 이미 있는 블로그에 시험 글을 넣었다가 끝나면 지운다 (조회·공감·댓글은 글과 함께 지워진다)
    const [{ username, nickname }] = await sql`select u.username, p.nickname from users u
      join blogs b on b.owner_id = u.id join profiles p on p.user_id = u.id order by b.id limit 1`;
    const tag = uid("p");
    const ids: number[] = [];
    const add = async (...args: Parameters<typeof addPost>) => {
      const id = await addPost(...args);
      ids.push(id);
      return id;
    };
    try {
      // 오늘 본 글: 오늘 300
      const today = await add(username, `${tag} 오늘 글`, 1);
      await addViews(today, 300, 0);
      // 3일 전 조회 400 + 지운 댓글 20 (세지 않음) → 400
      const views = await add(username, `${tag} 조회 글`, 4);
      await addViews(views, 400, 3);
      await addComments(views, 20, 3, true);
      // 3일 전 조회 380 + 공감 5 ×3 + 댓글 10 ×2 → 415
      const mixed = await add(username, `${tag} 공감 글`, 4);
      await addViews(mixed, 380, 3);
      await addLikes(mixed, 5, 3);
      await addComments(mixed, 10, 3);
      // 같은 350점: 늦게 쓴 글이 먼저
      const tieOld = await add(username, `${tag} 같은 점수 옛 글`, 5);
      const tieNew = await add(username, `${tag} 같은 점수 새 글`, 4);
      await addViews(tieOld, 350, 3);
      await addViews(tieNew, 350, 3);
      // 20일 전 조회 600: 이번 달에만
      const monthly = await add(username, `${tag} 이번 달 글`, 25);
      await addViews(monthly, 600, 20);
      // 점수가 높아도 안 보이는 글
      const hidden = [
        await add(username, `${tag} 비공개 글`, 1, { isPublic: false }),
        await add(username, `${tag} 블라인드 글`, 1, { isPublic: false, blinded: true }),
        await add(username, `${tag} 예약 글`, 1, { isPublic: false, scheduled: true }),
      ];
      for (const id of hidden) await addViews(id, 1000, 0);

      // 이번 주 (기본)
      await page.goto("/popular");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("🔥 인기 글");
      const tabs = page.getByRole("navigation", { name: "인기 글 기간" });
      await expect(tabs.getByRole("link", { name: "이번 주" })).toHaveAttribute("aria-current", "page");
      let order = (await ranked(page)).filter((id) => ids.includes(id));
      expect(order).toEqual([mixed, views, tieNew, tieOld, today]);
      // 카드: 순위·작성자·제목·숫자
      const card = page.locator(`[data-popular-post="${mixed}"]`);
      await expect(card.locator("[data-popular-rank]")).toHaveText(/^\d+위$/);
      await expect(card).toContainText(nickname);
      await expect(card.getByRole("heading", { level: 2 })).toHaveText(`${tag} 공감 글`);
      await expect(card).toContainText("♥ 5");
      await expect(card).toContainText("💬 10");
      await expect(page.getByText(`${tag} 비공개 글`)).toHaveCount(0);
      await expect(page.getByText(`${tag} 블라인드 글`)).toHaveCount(0);
      await expect(page.getByText(`${tag} 예약 글`)).toHaveCount(0);

      // 오늘: 오늘 본 글만
      await tabs.getByRole("link", { name: "오늘" }).click();
      await expect(page).toHaveURL(/\/popular\?range=today$/);
      await expect(tabs.getByRole("link", { name: "오늘" })).toHaveAttribute("aria-current", "page");
      await expect(page.locator(`[data-popular-post="${today}"]`)).toBeVisible();
      order = (await ranked(page)).filter((id) => ids.includes(id));
      expect(order).toEqual([today]);

      // 이번 달: 20일 전에 많이 읽힌 글이 맨 앞
      await tabs.getByRole("link", { name: "이번 달" }).click();
      await expect(page).toHaveURL(/\/popular\?range=month$/);
      await expect(page.locator(`[data-popular-post="${monthly}"]`)).toBeVisible();
      order = (await ranked(page)).filter((id) => ids.includes(id));
      expect(order).toEqual([monthly, mixed, views, tieNew, tieOld, today]);

      // 작성자 링크(블로그 홈)는 글자 폭만큼이라, 카드 틀 안 작성자 줄의 오른쪽 빈 곳을 눌러도 블로그 홈이 아니라 그 글
      const author = card.locator("[data-post-author]");
      await expect(author).toHaveAttribute("href", `/@${username}`);
      const cardBox = (await card.boundingBox())!;
      const authorBox = (await author.boundingBox())!;
      expect(authorBox.x + authorBox.width).toBeLessThan(cardBox.x + cardBox.width - 48);
      await page.mouse.click(cardBox.x + cardBox.width - 24, authorBox.y + authorBox.height / 2);
      await expect(page).toHaveURL(new RegExp(`/@${username}/${mixed}$`));
      await page.goBack();
      await expect(page).toHaveURL(/\/popular\?range=month$/);

      // 카드를 누르면 그 글
      await page.locator(`[data-popular-post="${monthly}"]`).getByRole("link", { name: new RegExp(`${tag} 이번 달 글`) }).click();
      await expect(page).toHaveURL(new RegExp(`/@${username}/${monthly}$`));
    } finally {
      if (ids.length) await sql`delete from posts where id in ${sql(ids)}`;
    }
  });

  test("마을 소식에서 🔥 인기 글로, 375px 화면에서 옆으로 넘치지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/feed");
    await page.getByRole("navigation", { name: "소식 탭" }).getByRole("link", { name: "🔥 인기 글" }).click();
    await expect(page).toHaveURL(/\/popular$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("🔥 인기 글");
    for (const url of ["/popular", "/popular?range=today", "/popular?range=month"]) {
      await page.goto(url);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, url).toBeLessThanOrEqual(0);
    }
  });

  test("sitemap에 인기 글이 있다", async ({ request }) => {
    const map = await (await request.get("/sitemap.xml")).text();
    expect(map).toMatch(/<loc>[^<]*\/popular<\/loc>/);
  });
});
