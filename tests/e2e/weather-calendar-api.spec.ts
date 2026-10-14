import { expect, test } from "./fixtures";
import { signUpOk, sql } from "./helpers";

// ☀️ 날씨·📅 캘린더 위젯이 부르는 주소. 위젯 화면 시험은 위젯 보드에 끼운 뒤 그쪽에서 본다.
test("캘린더: 그 달 날짜별 글, 주인이 아니면 공개 글만", async ({ page, browser }) => {
  const me = await signUpOk(page);
  const [blog] = await sql`select b.id from blogs b join users u on u.id = b.owner_id where u.username = ${me}`;
  await sql`insert into posts (blog_id, title, content_html, content_text, is_public, created_at) values
    (${blog.id}, '시월 글', '<p>a</p>', 'a', true, '2026-10-01 00:30+09'),
    (${blog.id}, '구월 끝 글', '<p>b</p>', 'b', true, '2026-09-30 23:30+09'),
    (${blog.id}, '시월 비밀 글', '<p>c</p>', 'c', false, '2026-10-01 01:00+09')`;

  const mine = await (await page.request.get(`/api/calendar?blog=${me}&month=2026-10`)).json();
  expect(mine).toEqual({ month: "2026-10", days: { "2026-10-01": [expect.objectContaining({ title: "시월 글" }), expect.objectContaining({ title: "시월 비밀 글" })] } });

  const visitor = await browser.newPage();
  const theirs = await (await visitor.request.get(`/api/calendar?blog=${me}&month=2026-10`)).json();
  expect(theirs.days["2026-10-01"].map((p: { title: string }) => p.title)).toEqual(["시월 글"]);
  const sept = await (await visitor.request.get(`/api/calendar?blog=${me}&month=2026-09`)).json();
  expect(Object.keys(sept.days)).toEqual(["2026-09-30"]);

  expect((await visitor.request.get(`/api/calendar?blog=${me}&month=2026-13`)).status()).toBe(400);
  expect((await visitor.request.get(`/api/calendar?blog=nobody_here_x&month=2026-10`)).status()).toBe(400);
});

test("날씨: 어느 곳인지 모르면 400", async ({ request }) => {
  expect((await request.get("/api/weather")).status()).toBe(400);
  expect((await request.get("/api/weather?city=tokyo")).status()).toBe(400);
  expect((await request.get("/api/weather?lat=95&lon=0")).status()).toBe(400);
});
