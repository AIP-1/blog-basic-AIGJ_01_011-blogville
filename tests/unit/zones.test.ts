import { describe, expect, it } from "vitest";
import { parseHostSlug, parseReturnSpot, RETURN_SPOTS, townReturnHref } from "@/lib/town/zones";

describe("광장으로 돌아오는 자리 (plaza-upgrade-2 C2·C4)", () => {
  it("home·prompt도 돌아올 자리다", () => {
    expect(RETURN_SPOTS).toContain("home");
    expect(RETURN_SPOTS).toContain("prompt");
    expect(parseReturnSpot("home")).toBe("home");
    expect(parseReturnSpot("prompt")).toBe("prompt");
    expect(parseReturnSpot("nope")).toBeNull();
    expect(parseReturnSpot(undefined)).toBeNull();
  });

  it("host가 있으면 그 친구 마을로, 없으면 중앙 광장 (기존 호출 그대로)", () => {
    expect(townReturnHref("shop")).toBe("/town?from=shop");
    expect(townReturnHref(null)).toBe("/town");
    expect(townReturnHref("shop", "mint")).toBe("/town/mint?from=shop");
    expect(townReturnHref("farm", "mint")).toBe("/town/mint?from=farm");
    expect(townReturnHref(null, "mint")).toBe("/town/mint");
  });

  it("?host= 는 블로그 주소 모양만", () => {
    expect(parseHostSlug("mint")).toBe("mint");
    expect(parseHostSlug(["mint_01"])).toBe("mint_01");
    expect(parseHostSlug("Mint")).toBeNull();
    expect(parseHostSlug("../x")).toBeNull();
    expect(parseHostSlug("ab")).toBeNull();
    expect(parseHostSlug(undefined)).toBeNull();
  });
});
