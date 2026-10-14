import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it, vi } from "vitest";
import { ocrSaysSponsored, sponsorImageUrls } from "@/lib/food-sponsor";
import { queueSponsorOcr, sponsorOcrState } from "@/server/food-ocr";

describe("협찬 배너 그림 고르기", () => {
  it("블로그 그림만, 글 앞 2장과 끝 4장을 작게", () => {
    const imgs = Array.from({ length: 9 }, (_, i) => `<img data-lazy-src="https://postfiles.pstatic.net/a/${i}.png?type=w773">`).join("");
    const out = sponsorImageUrls(`${imgs}<img src="https://evil.example/x.png"><img src="https://postfiles.pstatic.net/a/s.gif">`);
    expect(out).toEqual([0, 1, 5, 6, 7, 8].map((i) => `https://postfiles.pstatic.net/a/${i}.png?type=w400`));
  });

  it("읽은 글자에 협찬 표시가 있나", () => {
    expect(ocrSaysSponsored("본 포 스 팅 은 협 찬 을 포 함 합니다")).toBe(true);
    expect(ocrSaysSponsored("[| ] # 협 찬")).toBe(true);
    expect(ocrSaysSponsored("협찬 아님 내돈내산")).toBe(false);
    expect(ocrSaysSponsored("김치찌개 1인분 9,000원")).toBe(false);
  });
});

describe("그림 글자 읽기 (실제 한국어 인식)", () => {
  const png = readFileSync(new URL("../fixtures/sponsor-banner.png", import.meta.url));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(png, { headers: { "content-type": "image/png" } })),
  );
  afterAll(() => vi.unstubAllGlobals());

  it("'본 포스팅은 협찬을 포함합니다' 그림을 뒤에서 읽어 협찬으로 기억한다", async () => {
    const url = "https://blog.naver.com/test/1";
    queueSponsorOcr(url, ["https://postfiles.pstatic.net/a/banner.png?type=w400"]);
    expect(sponsorOcrState(url)).toBe("pending");
    for (let i = 0; i < 100 && sponsorOcrState(url) === "pending"; i++) await new Promise((r) => setTimeout(r, 100));
    expect(sponsorOcrState(url)).toBe("sponsored");
  }, 20_000);
});
