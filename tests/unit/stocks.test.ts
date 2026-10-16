import { describe, expect, it } from "vitest";
import { checkStock, formatChange, formatPrice, parseIndexChart, parseNaverQuote, parseNaverSearchItem, toNumber } from "@/lib/stocks";

describe("관심 종목 규칙", () => {
  it("국내 6자리·미국 로이터 코드만 받는다", () => {
    expect(checkStock("KR", "005930", " 삼성전자 ")).toEqual({ market: "KR", code: "005930", name: "삼성전자" });
    expect(checkStock("KR", "0001A0", "새 종목")).not.toBeNull();
    expect(checkStock("US", "AAPL.O", "애플")).not.toBeNull();
    expect(checkStock("US", "BRK-B.N", "버크셔")).not.toBeNull();
    expect(checkStock("KR", "5930", "짧음")).toBeNull();
    expect(checkStock("KR", "<script>", "나쁨")).toBeNull();
    expect(checkStock("JP", "7203", "도요타")).toBeNull();
    expect(checkStock("US", "AAPL.O", " ")).toBeNull();
    expect(checkStock("US", "AAPL.O", "가".repeat(61))).toBeNull();
  });

  it("쉼표 든 글자도 수로 읽는다", () => {
    expect(toNumber("71,000")).toBe(71000);
    expect(toNumber("-1.25")).toBe(-1.25);
    expect(toNumber(3)).toBe(3);
    expect(toNumber("N/A")).toBeNull();
    expect(toNumber(undefined)).toBeNull();
  });

  it("네이버 실시간 시세: 하락이면 등락이 양수로 와도 음수로 맞춘다", () => {
    const kr = parseNaverQuote({
      itemCode: "005930",
      stockName: "삼성전자",
      closePrice: "71,000",
      compareToPreviousClosePrice: "500",
      compareToPreviousPrice: { code: "5", text: "하락", name: "FALLING" },
      fluctuationsRatio: "0.70",
      marketStatus: "OPEN",
    });
    expect(kr).toMatchObject({ key: "005930", price: 71000, change: -500, rate: -0.7, status: "OPEN", name: "삼성전자" });
    const us = parseNaverQuote({
      reutersCode: "AAPL.O",
      closePrice: "227.50",
      compareToPreviousClosePrice: "1.25",
      compareToPreviousPrice: { code: "2", name: "RISING" },
      fluctuationsRatio: "0.55",
      currencyType: { code: "USD" },
    });
    expect(us).toMatchObject({ key: "AAPL.O", price: 227.5, change: 1.25, rate: 0.55, currency: "USD" });
    expect(parseNaverQuote({ closePrice: "1" })).toBeNull();
    expect(parseNaverQuote(null)).toBeNull();
  });

  it("네이버 검색: 국내는 code, 미국은 reutersCode, 나머지 나라는 뺀다", () => {
    expect(parseNaverSearchItem({ code: "005930", name: "삼성전자", nationCode: "KOR", reutersCode: "005930" })).toEqual({ market: "KR", code: "005930", name: "삼성전자" });
    expect(parseNaverSearchItem({ code: "AAPL", name: "애플", nationCode: "USA", reutersCode: "AAPL.O" })).toEqual({ market: "US", code: "AAPL.O", name: "애플" });
    expect(parseNaverSearchItem({ code: "7203", name: "도요타", nationCode: "JPN", reutersCode: "7203.T" })).toBeNull();
  });

  it("가격·등락 글자", () => {
    expect(formatPrice(71000, "KRW")).toBe("71,000");
    expect(formatPrice(227.5, "USD")).toBe("227.50");
    expect(formatChange(500, 0.71, "KRW")).toBe("▲ 500 (+0.71%)");
    expect(formatChange(-1.25, -0.55, "USD")).toBe("▼ 1.25 (-0.55%)");
    expect(formatChange(0, 0, "KRW")).toBe("0 (0.00%)");
    expect(formatChange(null, null, "KRW")).toBe("");
  });
});

describe("parseIndexChart (지수 하루 흐름)", () => {
  it("currentPrice만 모으고, 많으면 처음·끝을 지키며 고르게 솎는다", () => {
    expect(parseIndexChart([{ currentPrice: 1 }, { currentPrice: "2" }, { x: 1 }, null])).toEqual([1, 2]);
    const many = Array.from({ length: 391 }, (_, i) => ({ currentPrice: i }));
    const out = parseIndexChart(many, 80);
    expect(out).toHaveLength(80);
    expect(out[0]).toBe(0);
    expect(out.at(-1)).toBe(390);
    expect(parseIndexChart({ error: 1 })).toEqual([]);
  });
});

describe("정규장 밖 거래 (애프터마켓)", () => {
  it("15:30 뒤 넥스트레이드 애프터마켓이 거래 중이면 그 가격과 전날 종가 대비 등락을 쓴다", () => {
    const row = {
      itemCode: "005930",
      closePrice: "215,500",
      compareToPreviousClosePrice: "5,500",
      compareToPreviousPrice: { code: "2", name: "RISING" },
      fluctuationsRatio: "2.62",
      marketStatus: "OPEN",
      overMarketPriceInfo: { tradingSessionType: "AFTER_MARKET", overMarketStatus: "OPEN", overPrice: "216,000", compareToPreviousPrice: { code: "2", name: "RISING" }, compareToPreviousClosePrice: "6,000", fluctuationsRatio: "2.86" },
    };
    expect(parseNaverQuote(row)).toMatchObject({ price: 216000, change: 6000, rate: 2.86, session: "after" });
    // 애프터마켓이 끝났으면 정규장 종가
    expect(parseNaverQuote({ ...row, overMarketPriceInfo: { ...row.overMarketPriceInfo, overMarketStatus: "CLOSE" } })).toMatchObject({ price: 215500, change: 5500, session: null });
  });

  it("미국 프리·애프터마켓은 네이버 증권과 같은 등락(그 시간대 기준)을 그대로 쓴다", () => {
    const row = {
      reutersCode: "AAPL.O",
      closePrice: "342.00",
      compareToPreviousClosePrice: "2.00",
      compareToPreviousPrice: { code: "2", name: "RISING" },
      fluctuationsRatio: "0.59",
      marketStatus: "CLOSE",
      overMarketPriceInfo: { tradingSessionType: "PRE_MARKET", overMarketStatus: "OPEN", overPrice: "340.67", compareToPreviousPrice: { code: "5", name: "FALLING" }, compareToPreviousClosePrice: "-1.33", fluctuationsRatio: "-0.39" },
    };
    expect(parseNaverQuote(row)).toMatchObject({ price: 340.67, change: -1.33, rate: -0.39, session: "pre" });
    // 방향 표시가 없어도 부호를 그대로 믿는다
    const noDir = { ...row, overMarketPriceInfo: { ...row.overMarketPriceInfo, compareToPreviousPrice: undefined, tradingSessionType: "AFTER_MARKET" } };
    expect(parseNaverQuote(noDir)).toMatchObject({ price: 340.67, change: -1.33, rate: -0.39, session: "after" });
    // 상승은 부호 없이 와도 양수
    const up = { ...row, overMarketPriceInfo: { ...row.overMarketPriceInfo, compareToPreviousPrice: { code: "2", name: "RISING" }, compareToPreviousClosePrice: "1.20", fluctuationsRatio: "0.35" } };
    expect(parseNaverQuote(up)).toMatchObject({ change: 1.2, rate: 0.35 });
  });
});
