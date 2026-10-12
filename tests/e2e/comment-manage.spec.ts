import { expect, test, type Page } from "@playwright/test";
import { signUpOk, sql, writePost } from "./helpers";

// 블로그 관리 `💬 댓글 관리` (SOC-01 열린 질문), specs/024-comment-manage
test.describe.configure({ timeout: 60_000 });

const userId = async (username: string) => (await sql`select id from users where username = ${username}`)[0].id as string;
const rows = (page: Page) => page.locator("[data-comment]");

test.describe("댓글 관리", () => {
  test("내 글(비공개 포함)에 달린 댓글·답글을 최신순으로 모아 보고, 지우면 글에는 삭제된 자리가 남는다", async ({ page, browser }) => {
    const owner = await signUpOk(page);
    const first = await writePost(page, "첫 글", "본문");
    const secret = await writePost(page, "비밀 글", "본문", { private: true });
    const guestPage = await browser.newPage();
    const guest = await signUpOk(guestPage);
    const guestPost = await writePost(guestPage, "손님 글", "본문");
    const [o, g] = [await userId(owner), await userId(guest)];

    // 오래된 것부터: 손님 댓글 → 주인 답글 → 비밀 글에 주인 메모. 지운 댓글과 남의 블로그 댓글은 나오지 않는다.
    const [c1] = await sql`insert into comments (post_id, author_id, content, created_at) values (${first}, ${g}, '손님의 첫 댓글', now() - interval '3 hours') returning id`;
    const [r1] = await sql`insert into replies (comment_id, author_id, content, created_at) values (${c1.id}, ${o}, '주인의 답글', now() - interval '2 hours') returning id`;
    const [c2] = await sql`insert into comments (post_id, author_id, content, created_at) values (${secret}, ${o}, '비밀 글 메모', now() - interval '1 hour') returning id`;
    await sql`insert into comments (post_id, author_id, content, deleted_at) values (${first}, ${g}, '', now())`;
    await sql`insert into comments (post_id, author_id, content) values (${guestPost}, ${o}, '남의 블로그에 단 댓글')`;

    // 주인 도구 막대와 블로그 관리에서 들어온다
    await page.goto(`/@${owner}`);
    await expect(page.getByRole("navigation", { name: "주인 도구" }).getByRole("link", { name: "💬 댓글 관리" })).toHaveAttribute("href", "/settings/comments");
    await page.goto("/settings/blog");
    await page.getByRole("link", { name: "💬 댓글 관리" }).click();
    await expect(page).toHaveURL("/settings/comments");
    await expect(page.getByRole("heading", { level: 1, name: "💬 댓글 관리" })).toBeVisible();
    await expect(page).toHaveTitle("댓글 관리 | Blogville");
    await expect(page.getByRole("heading", { name: "내 글에 달린 댓글 3개" })).toBeVisible();
    await expect(rows(page)).toHaveCount(3);
    await expect(page.getByText("남의 블로그에 단 댓글")).toHaveCount(0);

    const [memo, reply, guestRow] = [rows(page).nth(0), rows(page).nth(1), rows(page).nth(2)];
    await expect(memo).toHaveAttribute("data-comment", `comment-${c2.id}`);
    await expect(memo).toContainText("비밀 글 메모");
    await expect(memo.getByRole("link", { name: "📄 비밀 글" })).toHaveAttribute("href", `/@${owner}/${secret}#comment-${c2.id}`);
    await expect(reply).toHaveAttribute("data-comment", `reply-${r1.id}`);
    await expect(reply).toContainText("↳ 답글");
    await expect(reply).toContainText("주인의 답글");
    await expect(reply.getByRole("link", { name: owner, exact: true })).toHaveAttribute("href", `/@${owner}`);
    await expect(guestRow).toHaveAttribute("data-comment", `comment-${c1.id}`);
    await expect(guestRow.getByRole("link", { name: guest, exact: true })).toHaveAttribute("href", `/@${guest}`);
    await expect(guestRow.locator("time")).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}T/);

    // 글 제목을 누르면 그 글의 그 댓글 자리로
    await guestRow.getByRole("link", { name: "📄 첫 글" }).click();
    await expect(page).toHaveURL(`/@${owner}/${first}#comment-${c1.id}`);
    await expect(page.locator(`#comment-${c1.id}`)).toContainText("손님의 첫 댓글");

    // [삭제]: 취소하면 그대로, 확인하면 목록에서 빠지고 글에는 `삭제된 댓글이에요` 자리와 답글이 남는다
    await page.goto("/settings/comments");
    let message = "";
    page.once("dialog", (d) => {
      message = d.message();
      d.dismiss();
    });
    await guestRow.getByRole("button", { name: `${guest}의 댓글 삭제` }).click();
    await expect.poll(() => message).toBe("댓글을 삭제할까요?");
    await expect(rows(page)).toHaveCount(3);
    page.once("dialog", (d) => d.accept());
    await guestRow.getByRole("button", { name: `${guest}의 댓글 삭제` }).click();
    await expect(page.getByRole("heading", { name: "내 글에 달린 댓글 2개" })).toBeVisible();
    await expect(rows(page)).toHaveCount(2);
    const [gone] = await sql`select content, deleted_at from comments where id = ${c1.id}`;
    expect(gone.content).toBe("");
    expect(gone.deleted_at).not.toBeNull();

    page.once("dialog", (d) => d.accept());
    await reply.getByRole("button", { name: `${owner}의 답글 삭제` }).click();
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "내 글에 달린 댓글 1개" })).toBeVisible();

    await page.goto(`/@${owner}/${first}`);
    await expect(page.locator(`#comment-${c1.id}`)).toContainText("삭제된 댓글이에요");
    await expect(page.locator(`#reply-${r1.id}`)).toContainText("삭제된 댓글이에요");
  });

  test("댓글이 없으면 안내, 20개가 넘으면 다음 쪽, 375px에서 가로 스크롤 없음, 방문자는 첫 화면으로", async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
    const owner = await signUpOk(page);
    await page.goto("/settings/comments");
    await expect(page.getByRole("heading", { name: "내 글에 달린 댓글 0개" })).toBeVisible();
    await expect(page.getByText("아직 달린 댓글이 없어요")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "페이지" })).toHaveCount(0);

    const post = await writePost(page, "댓글 많은 글", "본문");
    const o = await userId(owner);
    await sql`insert into comments (post_id, author_id, content, created_at)
      select ${post}, ${o}, '댓글 ' || i || ' ' || repeat('길게 ', 40), now() - make_interval(mins => i) from generate_series(1, 21) i`;

    await page.goto("/settings/comments");
    await expect(page.getByRole("heading", { name: "내 글에 달린 댓글 21개" })).toBeVisible();
    await expect(rows(page)).toHaveCount(20);
    await expect(rows(page).first()).toContainText("댓글 1 길게");
    // 긴 댓글은 한 줄로 줄인다
    await expect(rows(page).first()).toContainText("…");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const del = rows(page).first().getByRole("button", { name: /삭제/ });
    expect((await del.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    await page.getByRole("navigation", { name: "페이지" }).getByRole("link", { name: "2" }).click();
    await expect(page).toHaveURL("/settings/comments?page=2");
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("댓글 21 길게");
    await page.goto("/settings/comments?page=abc");
    await expect(rows(page)).toHaveCount(20);

    const visitor = await browser.newPage();
    await visitor.goto("/settings/comments");
    await expect(visitor).toHaveURL("/");
  });
});
