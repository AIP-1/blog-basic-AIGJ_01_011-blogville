import { expect, test } from "./fixtures";

// 보안 응답 헤더 (개선 1): 화면마다 붙고, 첨부(/files)는 자기 CSP를 그대로 쓴다
test("화면에 보안 헤더가 붙는다", async ({ page }) => {
  const res = await page.request.get("/");
  expect(res.headers()).toMatchObject({
    "strict-transport-security": "max-age=31536000",
    "x-frame-options": "SAMEORIGIN",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
  });
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'self'");
  expect(res.headers()["x-powered-by"]).toBeUndefined();

  const file = await page.request.get(`/files/${"0".repeat(32)}`);
  expect(file.status()).toBe(404);
  expect(file.headers()["content-security-policy"]).toBeUndefined();
  expect(file.headers()["x-frame-options"]).toBe("SAMEORIGIN");
});
