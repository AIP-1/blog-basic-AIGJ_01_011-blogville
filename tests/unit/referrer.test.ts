import { describe, expect, it } from "vitest";
import { referrerSource, sourceLabel } from "@/lib/referrer";

describe("referrerSource", () => {
  const site = "blog.example.com";
  it("없거나 이상하면 직접", () => {
    expect(referrerSource("", site)).toBe("direct");
    expect(referrerSource("not a url", site)).toBe("direct");
    expect(referrerSource("android-app://com.kakao.talk/", site)).toBe("direct");
  });
  it("우리 사이트·알려진 사이트는 이름으로, 검색어는 남기지 않는다", () => {
    expect(referrerSource("https://blog.example.com/feed", site)).toBe("blogville");
    expect(referrerSource("https://search.naver.com/search.naver?query=비밀", site)).toBe("naver");
    expect(referrerSource("https://m.blog.naver.com/x", site)).toBe("naver");
    expect(referrerSource("https://www.google.co.kr/", site)).toBe("google");
    expect(referrerSource("https://search.daum.net/search?q=a", site)).toBe("daum");
    expect(referrerSource("https://t.co/abc", site)).toBe("x");
  });
  it("그 밖은 호스트만 (www. 뺌)", () => {
    expect(referrerSource("https://www.okky.kr/articles/1?x=1", site)).toBe("okky.kr");
    expect(sourceLabel("okky.kr")).toBe("🌐 okky.kr");
    expect(sourceLabel("naver")).toBe("🟢 네이버");
  });
});
