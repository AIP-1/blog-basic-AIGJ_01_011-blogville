import { afterEach, describe, expect, it, vi } from "vitest";
import { browserKind, GeoError, geoErrorMessage, locate } from "@/lib/geolocate";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const MAC_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const MAC_CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

describe("browserKind (안내 문구 고르기)", () => {
  it("iPhone·iPad(데스크톱 모드 포함)·Mac Safari·나머지", () => {
    expect(browserKind(IPHONE)).toBe("ios");
    expect(browserKind(MAC_SAFARI, 5)).toBe("ios");
    expect(browserKind(MAC_SAFARI, 0)).toBe("mac-safari");
    expect(browserKind(MAC_CHROME)).toBe("other");
  });
  it("Safari는 설정 앱·시스템 설정 위치를 알려 준다", () => {
    expect(geoErrorMessage("denied", "ios")).toContain("Safari 웹 사이트");
    expect(geoErrorMessage("denied", "mac-safari")).toContain("시스템 설정");
    expect(geoErrorMessage("denied", "other")).toContain("자물쇠");
  });
});

type Cb = (p: unknown) => void;
function fakeGeo(answers: Array<{ ok: true } | { code: number } | "silent">) {
  const calls: PositionOptions[] = [];
  const getCurrentPosition = (ok: Cb, fail: Cb, options: PositionOptions) => {
    calls.push(options);
    const a = answers.shift();
    if (a === "silent" || !a) return;
    if ("ok" in a) ok({ coords: { latitude: 37.5, longitude: 127 } });
    else fail({ code: a.code });
  };
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
  return calls;
}

describe("locate (내 위치)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("바로 잡히면 그 자리", async () => {
    fakeGeo([{ ok: true }]);
    await expect(locate()).resolves.toEqual({ lat: 37.5, lng: 127 });
  });
  it("못 잡거나 시간이 넘으면 정밀 위치로 한 번 더 묻는다", async () => {
    const calls = fakeGeo([{ code: 3 }, { ok: true }]);
    await expect(locate()).resolves.toEqual({ lat: 37.5, lng: 127 });
    expect(calls.map((c) => c.enableHighAccuracy)).toEqual([false, true]);
  });
  it("권한이 꺼져 있으면 다시 묻지 않고 denied", async () => {
    const calls = fakeGeo([{ code: 1 }]);
    await expect(locate()).rejects.toEqual(new GeoError("denied"));
    expect(calls).toHaveLength(1);
  });
  it("답이 없어도 기다리다 unavailable로 끝난다", async () => {
    vi.useFakeTimers();
    fakeGeo(["silent", "silent"]);
    const p = locate().catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await p).toEqual(new GeoError("unavailable"));
  });
  it("위치 기능이 없으면 unsupported", async () => {
    vi.stubGlobal("navigator", {});
    await expect(locate()).rejects.toEqual(new GeoError("unsupported"));
  });
});
