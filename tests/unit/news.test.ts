import { describe, expect, it } from "vitest";
import { cleanTitle, isNewsTab, pickIssues, sourceOf, titleWords } from "@/lib/news";

const at = (min: number) => new Date(Date.UTC(2026, 9, 14, 6, 0) - min * 60_000).toUTCString();
const item = (title: string, url: string, min = 0) => ({ title, originallink: url, link: "https://n.news.naver.com/x", pubDate: at(min) });

describe("뉴스 위젯", () => {
  it("제목의 <b>·엔티티를 지운다", () => {
    expect(cleanTitle("&quot;<b>속보</b>&quot; 금리 &amp; 환율 &#8230;")).toBe('"속보" 금리 & 환율 …');
  });
  it("도메인 → 언론사, 모르면 도메인", () => {
    expect(sourceOf("https://www.yna.co.kr/view/AKR1")).toBe("연합뉴스");
    expect(sourceOf("https://m.news1.kr/a")).toBe("뉴스1");
    expect(sourceOf("https://example.org/a")).toBe("example.org");
    expect(sourceOf("x")).toBe("");
  });
  it("제목 낱말: 머리말·괄호·흔한 말·조사를 뺀다", () => {
    expect([...titleWords("[속보] 한국은행, 기준금리 동결…(종합)")]).toEqual(["한국은행", "기준금리", "동결"]);
  });
  it("여러 언론이 같이 다룬 이야기가 먼저, 묶음마다 가장 최근 기사, 링크·시각이 없는 줄은 버린다", () => {
    const issues = pickIssues([
      item("한국은행 기준금리 동결…연 2.5% 유지", "https://www.yna.co.kr/1", 10),
      item("[속보] 한국은행 기준금리 연 2.5% 동결", "https://www.news1.kr/2", 5),
      item("한은, 기준금리 2.5% 동결 결정", "https://www.hankyung.com/3", 1),
      item("손흥민 시즌 첫 골", "https://www.osen.co.kr/4", 0),
      item("새 스마트폰 공개", "https://www.etnews.com/5", 2),
      item("새 스마트폰 공개 임박", "https://www.zdnet.co.kr/6", 3),
      { title: "링크 없음", pubDate: at(0) },
      { title: "시각 없음", originallink: "https://a.com/x" },
    ]);
    expect(issues.map((i) => i.url)).toEqual(["https://www.hankyung.com/3", "https://www.etnews.com/5", "https://www.osen.co.kr/4"]);
    expect(issues[0]).toMatchObject({ source: "한국경제", count: 3 });
    expect(issues[1].count).toBe(2);
  });
  it("모양이 다르면 빈 목록, 탭은 정해 둔 것만", () => {
    expect(pickIssues(null)).toEqual([]);
    expect(isNewsTab("economy")).toBe(true);
    expect(isNewsTab("politics; drop")).toBe(false);
  });
});
