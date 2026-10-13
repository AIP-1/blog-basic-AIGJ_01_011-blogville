import { expect, test } from "./fixtures";
import { png, uploadDirect } from "./files";
import { signUpOk } from "./helpers";

// 사진 썸네일: /files/키?w=96|320|640 → 작은 webp. 다른 값·gif는 원본 그대로, 권한은 원본과 같다

const webpWidth = (buf: Buffer) => {
  // VP8 손실 압축 webp: "VP8 " 덩어리 안 26번째 바이트부터 너비 14비트
  expect(buf.subarray(0, 4).toString("ascii")).toBe("RIFF");
  expect(buf.subarray(8, 12).toString("ascii")).toBe("WEBP");
  expect(buf.subarray(12, 16).toString("ascii")).toBe("VP8 ");
  return buf.readUInt16LE(26) & 0x3fff;
};

test("큰 사진은 정한 너비의 webp로 줄이고, 작은 사진은 키우지 않는다", async ({ page, browser }) => {
  await signUpOk(page);
  const big = await uploadDirect(page, png("큰사진.png", 1200, 800));
  const res = await page.request.get(`${big.json.url}?w=320`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/webp");
  // 아직 글에 붙지 않은 사진이라 권한 확인은 원본과 같이 매번
  expect(res.headers()["cache-control"]).toBe("private, no-cache");
  const body = await res.body();
  expect(webpWidth(body)).toBe(320);

  // 두 번째는 저장해 둔 파일을 준다 (같은 내용)
  expect((await page.request.get(`${big.json.url}?w=320`).then((r) => r.body())).equals(body)).toBe(true);

  // 정하지 않은 너비는 원본
  const other = await page.request.get(`${big.json.url}?w=123`);
  expect(other.headers()["content-type"]).toBe("image/png");

  // 원본보다 큰 너비를 달라고 해도 키우지 않는다
  const small = await uploadDirect(page, png("작은사진.png", 40, 30));
  expect(webpWidth(await page.request.get(`${small.json.url}?w=640`).then((r) => r.body()))).toBe(40);

  // 남은 볼 수 없는 사진은 썸네일도 볼 수 없다
  const visitor = await browser.newPage();
  expect((await visitor.request.get(`${big.json.url}?w=320`)).status()).toBe(404);
});
