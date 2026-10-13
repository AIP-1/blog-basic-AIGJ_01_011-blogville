import { expect, test, type Page } from "./fixtures";
import { signUpOk, sql } from "./helpers";

// 걸어 다니는 이웃 (TOWN-19), specs/050-town-npc
test.describe.configure({ timeout: 90_000 });

const canvas = (page: Page) => page.locator("[data-town] canvas");
const userId = async (username: string) => (await sql`select id from users where username = ${username}`)[0].id as string;
const npcAt = async (page: Page) =>
  ((await canvas(page).getAttribute("data-npc-at")) ?? "")
    .split(" ")
    .filter(Boolean)
    .map((s) => {
      const [lot, xy] = s.split(":");
      const [x, y] = xy.split(",").map(Number);
      return { lot: Number(lot), x, y };
    });

test.describe("TOWN-19 걸어 다니는 이웃", () => {
  test("즐겨찾는 이웃이 길을 걸어 다니고, 누르면 그 이웃 집 우체통이 열린다", async ({ page, browser }) => {
    const me = await signUpOk(page);
    const names: string[] = [];
    for (let i = 0; i < 2; i++) {
      const p = await browser.newPage();
      names.push(await signUpOk(p));
      await p.close();
    }
    const meId = await userId(me);
    await sql`insert into follows (follower_id, followee_id, is_favorite, created_at) values
      (${meId}, ${await userId(names[0])}, true, now() - interval '2 minutes'),
      (${meId}, ${await userId(names[1])}, true, now() - interval '1 minute')`;
    await sql`insert into posts (blog_id, title, content_html, content_text, is_public, created_at)
      select b.id, '이웃 우체통 글', '<p>글</p>', '글', true, '2001-01-01' from blogs b where b.slug = ${names[0]}`;

    await page.goto("/town");
    await expect(canvas(page)).toHaveAttribute("data-ready", "1");
    await expect(canvas(page)).toHaveAttribute("data-npcs", "2");
    // 1번 집 근처로 가서 기다리면 이웃이 걷는다
    await canvas(page).evaluate((c) => c.dispatchEvent(new CustomEvent("bv-teleport", { detail: { x: 560, y: 560 } })));
    await expect.poll(async () => Number(await canvas(page).getAttribute("data-npc-walking")), { timeout: 10_000 }).toBeGreaterThan(0);
    const first = (await npcAt(page)).find((n) => n.lot === 1);
    expect(first).toBeTruthy();
    await page.waitForTimeout(1000);
    const later = (await npcAt(page)).find((n) => n.lot === 1);
    expect(later && Math.hypot(later.x - first!.x, later.y - first!.y)).toBeGreaterThan(10);

    // 누르면 그 이웃 집 우체통 (움직이므로 좌표를 읽자마자 누른다)
    const box = (await canvas(page).boundingBox())!;
    await expect
      .poll(
        async () => {
          const npc = (await npcAt(page)).find((n) => n.lot === 1);
          if (npc) await page.mouse.click(box.x + npc.x, box.y + npc.y);
          return page.locator('[data-town-panel="mailbox"]').count();
        },
        { timeout: 10_000 },
      )
      .toBe(1);
    await expect(page.locator('[data-town-panel="mailbox"]')).toContainText(`📮 ${names[0]}님의 우체통`);
    await expect(page.locator('[data-town-panel="mailbox"]')).toContainText("이웃 우체통 글");
  });

  test("방문자 마을도 집이 선 이웃만큼 걷고, 이웃이 없으면 아무도 없다", async ({ page }) => {
    await page.goto("/town");
    await expect(canvas(page)).toHaveAttribute("data-ready", "1");
    const roofs = ((await canvas(page).getAttribute("data-roofs")) ?? "").split(" ").filter((r) => r && !r.startsWith("0:"));
    await expect(canvas(page)).toHaveAttribute("data-npcs", String(roofs.length));

    await signUpOk(page);
    await page.goto("/town");
    await expect(canvas(page)).toHaveAttribute("data-ready", "1");
    await expect(canvas(page)).toHaveAttribute("data-npcs", "0");
    await expect(canvas(page)).toHaveAttribute("data-npc-at", "");
  });
});
