import { expect, test, type Page } from "./fixtures";
import { signUpOk, sql } from "./helpers";

// 광장 개편 2 · 세계 (A1~A6): 게시판 세 문, 줄등 초롱, 말풍선 누르기, 넓은 화면 서랍 비키기, 방문자 내 집 자리.
// 게임은 캔버스라 `data-*` 훅과 `bv-teleport`로 본다. 오늘 할 일(`tasks`)·계절(`season`)·글 쓰고 돌아온 순간(`celebrate`)은
// 페이지가 넘겨야 보이는 것이라 그 연결이 들어온 뒤에 켠다 (test.fixme).
test.describe.configure({ timeout: 90_000 });

const canvas = (page: Page) => page.locator("[data-town] canvas");
const prompt = (page: Page) => page.locator("[data-town-prompt]");
const feet = async (page: Page) => (await canvas(page).getAttribute("data-feet"))!.split(",").map(Number) as [number, number];
const camera = async (page: Page) => (await canvas(page).getAttribute("data-camera"))!.split(",").map(Number) as [number, number];
const teleport = (page: Page, x: number, y: number) =>
  canvas(page).evaluate((c, d) => c.dispatchEvent(new CustomEvent("bv-teleport", { detail: d })), { x, y });
async function openTown(page: Page, url = "/town") {
  await page.goto(url);
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
}
/** 세계 좌표를 페이지 좌표로 (지금 카메라) */
async function toPage(page: Page, x: number, y: number) {
  const box = (await canvas(page).boundingBox())!;
  const [cx, cy] = await camera(page);
  return { x: box.x + x - cx, y: box.y + y - cy };
}
/** 회원과 즐겨찾는 이웃 (1번 자리), 이웃은 한 시간 전에 글을 썼다 */
async function memberWithNeighbor(page: Page, browser: import("@playwright/test").Browser) {
  const username = await signUpOk(page);
  const other = await browser.newPage();
  const neighbor = await signUpOk(other);
  await other.close();
  await sql`insert into follows (follower_id, followee_id, is_favorite)
    select a.id, b.id, true from users a, users b where a.username = ${username} and b.username = ${neighbor}`;
  const [post] = await sql<{ id: number }[]>`insert into posts (blog_id, title, content_html, content_text, is_public, created_at)
    select b.id, '줄등 아래 읽는 글', '<p>본문</p>', '본문', true, now() - interval '1 hour'
    from blogs b join users u on u.id = b.owner_id where u.username = ${neighbor} returning id`;
  return { username, neighbor, postId: post.id };
}

test.describe("광장 개편 2 · 세계", () => {
  test("방문자: 게시판 가운데 문은 이번 주 글감, 할 일 쪽지는 없다, 내 정원에는 내 집 지을 자리", async ({ page }) => {
    await openTown(page);
    await expect(canvas(page)).toHaveAttribute("data-markers", "");
    await teleport(page, 1000, 540);
    await expect(prompt(page)).toHaveText("📝 이번 주 글감 · Space 들어가기");
    await expect.poll(async () => (await canvas(page).getAttribute("data-tags"))?.split("|") ?? []).toContain("마을 게시판");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/prompt");

    await openTown(page);
    await teleport(page, 1000, 1290);
    await expect(prompt(page)).toHaveText("🏡 여기에 내 집 짓기 · Space 가입하기");
    await page.keyboard.press("Space");
    await expect(page).toHaveURL("/");
  });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    test(`${viewport.width}px: 게시판 '글감' 팻말을 누르면 걸어가서 이번 주 글감으로`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openTown(page);
      await teleport(page, 1000, 700);
      await expect.poll(async () => (await camera(page))[1]).toBeLessThan(470);
      const at = await toPage(page, 1000, 470);
      await page.mouse.click(at.x, at.y);
      await expect(page).toHaveURL("/prompt", { timeout: 8000 });
    });
  }

  test("회원: 글 쓴 이웃의 초롱이 켜지고 그 아래 Space로 글, 이웃 머리 위 말풍선을 누르면 그 글", async ({ page, browser }) => {
    const { neighbor, postId } = await memberWithNeighbor(page, browser);
    await openTown(page);
    await expect(canvas(page)).toHaveAttribute("data-lanterns", "1:1");
    await expect(canvas(page)).toHaveAttribute("data-flags", "1");

    // 줄등 북서쪽 줄 가운데 초롱 아래
    await teleport(page, 923, 707);
    await expect(prompt(page)).toContainText("🏮 ");
    await expect(prompt(page)).toContainText("Space 글 읽기");
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(`/@${neighbor}/${postId}`);

    // 1번 자리 이웃 곁에 서면 새 글 제목 말풍선 (`data-bubbles`: 자리:화면 x,y), 누르면 그 글
    await openTown(page, `/town?at=${neighbor}`);
    await expect(async () => {
      const at = (await canvas(page).getAttribute("data-npc-at")) ?? "";
      const me = at.split(" ").find((s) => s.startsWith("1:"));
      expect(me).toBeTruthy();
      const [sx, sy] = me!.slice(2).split(",").map(Number);
      const [cx, cy] = await camera(page);
      await teleport(page, sx + cx + 30, sy + cy + 32);
      await expect(canvas(page)).toHaveAttribute("data-bubbles", /^1:\d+,\d+$/, { timeout: 2000 });
      const [bx, by] = (await canvas(page).getAttribute("data-bubbles"))!.slice(2).split(",").map(Number);
      const box = (await canvas(page).boundingBox())!;
      await page.mouse.click(box.x + bx, box.y + by);
      await expect(page).toHaveURL(`/@${neighbor}/${postId}`, { timeout: 3000 });
    }).toPass({ timeout: 30_000 });
  });

  test("1920px: 펼친 서랍이 동쪽 이웃 집 우체통을 가리지 않는다", async ({ page, browser }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await memberWithNeighbor(page, browser);
    await openTown(page);
    const drawer = page.locator("[data-town-drawer]");
    await expect(drawer).toBeVisible();
    for (const y of [380, 640, 900, 1160]) {
      await teleport(page, 1700, y + 40);
      await expect.poll(async () => (await feet(page)).join(",")).toBe(`1700,${y + 40}`);
      await page.waitForTimeout(100);
      const box = (await drawer.boundingBox())!;
      expect(box.width).toBeGreaterThan(200);
      // 우체통 오른쪽 끝 (집 자리 x + 118, 그림 반폭 20)
      const right = await toPage(page, 1700 + 118 + 20, y);
      expect(right.x).toBeLessThan(box.x);
    }
  });

  test.fixme("오늘 할 일 '!' 쪽지 (`tasks`): 낚시터·농장·내 집 쪽지, 누르면 걸어가 들어간다", async () => {
    // 페이지가 `tasks`를 넘기면: data-markers가 "pond farm home" 중 안 한 일, 쪽지를 누르면 그 입구로
  });
  test.fixme("계절 (`season`): ?season=winter면 data-season=winter", async () => {
    // 페이지가 `season`을 넘기면 켠다
  });
  test.fixme("글 쓰고 돌아온 순간 (`celebrate`): /town?from=home&lit=1이면 data-celebrate=1, 쪽지에 '이웃'", async () => {
    // 페이지가 `celebrate`를 넘기면 켠다
  });
});
