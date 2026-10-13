import { expect, test } from "./fixtures";
import { signUpOk, sql } from "./helpers";

// 예약 발행 (개선 11). 서버가 30초마다 시각이 된 예약 글을 공개한다
test.describe.configure({ timeout: 90_000 });

test("예약한 글은 나만 보고, 시각이 되면 그 시각 날짜로 공개되며 보상을 받는다", async ({ page, browser }) => {
  const username = await signUpOk(page);
  await page.goto("/write");
  await page.getByLabel("제목", { exact: true }).fill("예약 글");
  await page.getByLabel("본문").click();
  await page.keyboard.type("가".repeat(120));
  await page.getByText("⏰ 예약").click();
  const when = page.getByLabel("예약 시간");
  await expect(when).not.toHaveValue("");
  await expect(page.locator("[data-reward-hint]")).toContainText("예약 시간에 공개되면 보상");

  // 5분 안은 고를 수 없다
  const soon = new Date(Date.now() + 9 * 3_600_000 + 60_000).toISOString().slice(0, 16);
  await when.fill(soon);
  await page.getByRole("button", { name: "예약하기" }).click();
  await expect(page.locator(".form-error")).toHaveText("예약은 지금부터 5분 뒤부터 할 수 있어요");

  await when.fill("2099-01-01T09:00");
  await page.getByRole("button", { name: "예약하기" }).click();
  await expect(page.locator(".form-error")).toHaveText("예약은 90일 안으로만 할 수 있어요");

  const later = new Date(Date.now() + 9 * 3_600_000 + 2 * 3_600_000).toISOString().slice(0, 16);
  await when.fill(later);
  await page.getByRole("button", { name: "예약하기" }).click();
  await expect(page).toHaveURL(new RegExp(`/@${username}/\\d+$`));
  const id = Number(page.url().split("/").pop());
  await expect(page.getByText(/⏰ .+ 공개 예약/)).toBeVisible();
  await expect(page.locator("[role=status]").filter({ hasText: "발행" })).toHaveCount(0);

  // 수정 화면에 예약 시간이 그대로
  await page.goto(`/write/${id}`);
  await expect(page.getByLabel("예약 시간")).toHaveValue(later);

  const visitor = await browser.newPage();
  expect((await visitor.goto(`/@${username}/${id}`))!.status()).toBe(404);
  const [{ n: before }] = await sql`select count(*)::int as n from point_ledger where reason = 'post' and ref_id = ${String(id)}`;
  expect(before).toBe(0);

  // 시각을 지난 것으로 당긴다
  const [{ at }] = await sql`update posts set publish_at = now() - interval '1 minute' where id = ${id} returning publish_at as at`;
  await expect(async () => {
    expect((await visitor.request.get(`/@${username}/${id}`)).status()).toBe(200);
  }).toPass({ timeout: 45_000, intervals: [2_000] });
  const [row] = await sql`select is_public, publish_at, created_at from posts where id = ${id}`;
  expect(row.is_public).toBe(true);
  expect(row.publish_at).toBeNull();
  expect(row.created_at.getTime()).toBe(at.getTime());
  const [{ n }] = await sql`select count(*)::int as n from point_ledger where reason = 'post' and ref_id = ${String(id)}`;
  expect(n).toBe(1);

  await page.goto(`/@${username}`);
  await expect(page.getByText(/공개 예약/)).toHaveCount(0);
});

test("예약 글을 공개·비공개로 바꾸면 예약이 풀린다", async ({ page }) => {
  const username = await signUpOk(page);
  await page.goto("/write");
  await page.getByLabel("제목", { exact: true }).fill("예약 취소");
  await page.getByLabel("본문").click();
  await page.keyboard.type("본문");
  await page.getByText("⏰ 예약").click();
  await page.getByRole("button", { name: "예약하기" }).click();
  await expect(page).toHaveURL(new RegExp(`/@${username}/\\d+$`));
  const id = Number(page.url().split("/").pop());

  await page.goto(`/write/${id}`);
  await page.getByText("🔒 비공개").click();
  await page.getByRole("button", { name: "수정 완료" }).click();
  await expect(page).toHaveURL(`/@${username}/${id}`);
  await expect(page.getByText("🔒 비공개")).toBeVisible();
  const [row] = await sql`select is_public, publish_at from posts where id = ${id}`;
  expect(row).toEqual({ is_public: false, publish_at: null });
});
