import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cached, clearCached } from "@/server/ttl-cache";

beforeEach(() => vi.stubEnv("NODE_ENV", "production"));

afterEach(() => {
  clearCached();
  vi.unstubAllEnvs();
});

describe("잠깐 기억하기 (무거운 집계)", () => {
  it("기억하는 동안은 한 번만 세고, 시간이 지나면 다시 센다", async () => {
    const load = vi.fn(async () => 1);
    expect(await cached("a", 1000, load, 0)).toBe(1);
    expect(await cached("a", 1000, load, 999)).toBe(1);
    expect(load).toHaveBeenCalledTimes(1);
    await cached("a", 1000, load, 1000);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("같은 때 들어온 요청은 하나의 결과를 나눠 쓰고, 드리즐처럼 await마다 다시 도는 값도 한 번만 돈다", async () => {
    let runs = 0;
    const thenable = { then: (ok: (v: number) => void) => ok(++runs) } as unknown as PromiseLike<number>;
    const [a, b] = await Promise.all([cached("q", 1000, () => thenable, 0), cached("q", 1000, () => thenable, 1)]);
    expect([a, b, runs]).toEqual([1, 1, 1]);
  });

  it("실패한 결과는 기억하지 않는다", async () => {
    await expect(cached("e", 1000, async () => { throw new Error("x"); }, 0)).rejects.toThrow("x");
    expect(await cached("e", 1000, async () => 2, 1)).toBe(2);
  });

  it.each([
    ["SHARED_CACHE=off (화면 시험)", "SHARED_CACHE", "off"],
    ["개발 서버", "NODE_ENV", "development"],
  ])("%s면 매번 센다", async (_, name, value) => {
    vi.stubEnv(name, value);
    const load = vi.fn(async () => 1);
    await cached("o", 1000, load, 0);
    await cached("o", 1000, load, 1);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
