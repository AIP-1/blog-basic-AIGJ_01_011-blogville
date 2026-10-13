import { expect, test, type Page } from "./fixtures";
import { PASSWORD, signIn, signUp, signUpOk, sql, writePost } from "./helpers";

// 회원 탈퇴 (AUTH-06, specs/011-withdraw)
test.describe.configure({ timeout: 60_000 });

const pw = (page: Page) => page.getByLabel("탈퇴 확인 비밀번호");
const withdrawBtn = (page: Page) => page.getByRole("button", { name: "회원 탈퇴" });

async function rowsOf(userId: string, username: string) {
  const [r] = await sql`select
    (select count(*) from users where id = ${userId})::int as users,
    (select count(*) from accounts where user_id = ${userId})::int as accounts,
    (select count(*) from sessions where user_id = ${userId})::int as sessions,
    (select count(*) from profiles where user_id = ${userId})::int as profiles,
    (select count(*) from blogs where owner_id = ${userId})::int as blogs,
    (select count(*) from posts p join blogs b on b.id = p.blog_id where b.owner_id = ${userId})::int as posts,
    (select count(*) from follows where follower_id = ${userId} or followee_id = ${userId})::int as follows,
    (select count(*) from post_likes where user_id = ${userId})::int as likes,
    (select count(*) from comments where author_id = ${userId})::int as comments,
    (select count(*) from replies where author_id = ${userId})::int as replies,
    (select count(*) from login_attempts where username = ${username})::int as attempts`;
  return r;
}

test.describe("AUTH-06 회원 탈퇴", () => {
  test("빈 칸·틀린 비밀번호는 문구만, 비밀번호 칸을 비우고 아무것도 지우지 않는다", async ({ page }) => {
    const me = await signUpOk(page);
    await page.goto("/settings/blog");
    await page.getByRole("link", { name: "👤 내 정보" }).click();
    await expect(page).toHaveURL(/\/settings\/account$/);
    await expect(page.getByText("탈퇴하면 바로 지워지고 되돌릴 수 없어요.", { exact: false })).toBeVisible();

    let dialogs = 0;
    page.on("dialog", (d) => {
      dialogs++;
      d.dismiss();
    });
    await withdrawBtn(page).click();
    await expect(page.locator(".form-error")).toHaveText("비밀번호를 적어 주세요");
    await pw(page).fill("wrongpass1");
    await withdrawBtn(page).click();
    await expect(page.locator(".form-error")).toHaveText("비밀번호가 맞지 않아요");
    await expect(pw(page)).toHaveValue("");
    expect(dialogs).toBe(0);
    expect(await sql`select 1 from users where username = ${me}`).toHaveLength(1);
  });

  test("맞으면 첫 화면으로, 쿠키·데이터가 지워지고 로그인 못 하며 블로그는 404, 같은 아이디로 다시 가입된다", async ({ page, browser }) => {
    const me = await signUpOk(page);
    const [{ id: userId }] = await sql`select id from users where username = ${me}`;
    const postId = await writePost(page, "내 글", "본문");

    // 남의 블로그에 이웃·공감·댓글·답글을 남긴다
    const other = await browser.newPage();
    const o = await signUpOk(other);
    const [{ id: otherId }] = await sql`select id from users where username = ${o}`;
    const otherPost = await writePost(other, "남의 글", "본문");
    await sql`insert into follows (follower_id, followee_id) values (${userId}, ${otherId}), (${otherId}, ${userId})`;
    await sql`insert into post_likes (post_id, user_id) values (${otherPost}, ${userId}), (${postId}, ${otherId})`;
    const [lone] = await sql`insert into comments (post_id, author_id, content) values (${otherPost}, ${userId}, '혼자인 내 댓글') returning id`;
    const [kept] = await sql`insert into comments (post_id, author_id, content) values (${otherPost}, ${userId}, '답글 달린 내 댓글') returning id`;
    await sql`insert into replies (comment_id, author_id, content) values (${kept.id}, ${otherId}, '남의 답글')`;
    const [theirs] = await sql`insert into comments (post_id, author_id, content) values (${otherPost}, ${otherId}, '남의 댓글') returning id`;
    await sql`insert into replies (comment_id, author_id, content) values (${theirs.id}, ${userId}, '내 답글')`;
    await sql`insert into login_attempts (username, failures) values (${me}, 1) on conflict do nothing`;

    await page.goto("/settings/account");
    await pw(page).fill(PASSWORD);
    await withdrawBtn(page).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("tab", { name: "회원가입" })).toBeVisible();
    expect((await page.context().cookies()).filter((c) => c.name.includes("session_token"))).toHaveLength(0);

    expect(await rowsOf(userId, me)).toEqual({
      users: 0, accounts: 0, sessions: 0, profiles: 0, blogs: 0, posts: 0, follows: 0, likes: 0, comments: 0, replies: 0, attempts: 0,
    });
    // 혼자인 댓글은 지우고, 남의 답글이 달린 댓글은 작성자·내용 없는 자리만 남긴다. 남의 답글은 그대로.
    expect(await sql`select 1 from comments where id = ${lone.id}`).toHaveLength(0);
    const [place] = await sql`select author_id, content, deleted_at from comments where id = ${kept.id}`;
    expect(place).toMatchObject({ author_id: null, content: "" });
    expect(place.deleted_at).not.toBeNull();
    expect(await sql`select 1 from replies where comment_id = ${kept.id}`).toHaveLength(1);
    expect(await sql`select 1 from comments where id = ${theirs.id}`).toHaveLength(1);

    // 글 상세에 탈퇴한 회원의 닉네임·댓글 원문이 없다
    await other.goto(`/@${o}/${otherPost}`);
    await expect(other.getByText("삭제된 댓글이에요")).toBeVisible();
    await expect(other.getByText("남의 답글")).toBeVisible();
    // 탈퇴한 회원의 자리는 닉네임·시각 없이 문구만 (AUTH-06)
    const keptPlace = other.locator(`#comment-${kept.id}`);
    await expect(keptPlace).toHaveText("삭제된 댓글이에요");
    await expect(keptPlace.locator("time")).toHaveCount(0);
    const html = await other.content();
    for (const gone of ["혼자인 내 댓글", "답글 달린 내 댓글", "내 답글"]) expect(html).not.toContain(gone);
    expect(html).not.toContain(`/@${me}`);

    expect((await page.goto(`/@${me}`))!.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "길을 잃었어요" })).toBeVisible();
    await signIn(page, me, PASSWORD);
    await expect(page.locator(".form-error")).toHaveText("아이디 또는 비밀번호가 맞지 않아요");

    await page.context().clearCookies();
    await signUp(page, me);
    await expect(page).toHaveURL(new RegExp(`/@${me}\\?welcome=1$`));
  });
});
