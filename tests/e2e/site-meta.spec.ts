import { expect, test } from "./fixtures";

// 기본 공유 그림·홈 화면 아이콘·주소창 색
test("기본 공유 그림과 앱 정보", async ({ page }) => {
  const og = await page.request.get("/opengraph-image");
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toBe("image/png");
  const icon = await page.request.get("/apple-icon");
  expect(icon.headers()["content-type"]).toBe("image/png");
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "Blogville", start_url: "/", display: "standalone" });

  await page.goto("/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/opengraph-image/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
});
