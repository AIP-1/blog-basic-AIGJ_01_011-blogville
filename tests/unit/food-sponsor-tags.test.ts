import { describe, expect, it } from "vitest";
import { naverPostId, naverTagListUrl, parseNaverTags, tagsSponsored } from "@/lib/food-sponsor";

describe("네이버 블로그 태그로 밝힌 협찬 (#협찬)", () => {
  it("글 주소에서 블로그 ID·글 번호, 태그 목록 주소", () => {
    expect(naverPostId("https://blog.naver.com/abc_1/224446500961")).toEqual({ blogId: "abc_1", logNo: "224446500961" });
    expect(naverPostId("https://m.blog.naver.com/PostView.naver?blogId=abc&logNo=123")).toEqual({ blogId: "abc", logNo: "123" });
    expect(naverPostId("https://foo.tistory.com/1")).toBeNull();
    expect(naverTagListUrl({ blogId: "abc", logNo: "123" })).toBe("https://blog.naver.com/BlogTagListInfo.naver?blogId=abc&logNoList=123&logType=mylog");
  });

  it("태그 목록 응답(주소 인코딩된 쉼표 목록)을 읽는다", () => {
    const body = `{\n "taglist":[ {"msg":"","logno":"1", "tagName":"${encodeURIComponent("광주맛집,협찬,상무지구")}"} ]}`;
    expect(parseNaverTags(body)).toEqual(["광주맛집", "협찬", "상무지구"]);
    expect(parseNaverTags("<html>")).toEqual([]);
    expect(parseNaverTags('{"taglist":[{"tagName":""}]}')).toEqual([]);
  });

  it("협찬·체험단·원고료·제품제공 태그는 협찬, 협찬아님·내돈내산·체험학습은 아니다", () => {
    expect(tagsSponsored(["광주맛집", "협찬"])).toBe(true);
    expect(tagsSponsored(["속초체험단"])).toBe(true);
    expect(tagsSponsored(["#원고료"])).toBe(true);
    expect(tagsSponsored(["제품제공"])).toBe(true);
    expect(tagsSponsored(["광고"])).toBe(true);
    expect(tagsSponsored(["협찬아님", "내돈내산"])).toBe(false);
    expect(tagsSponsored(["체험학습", "광주맛집", "광고판"])).toBe(false);
    expect(tagsSponsored([])).toBe(false);
  });
});
