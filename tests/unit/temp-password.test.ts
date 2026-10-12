import { describe, expect, it } from "vitest";
import { makeTempPassword, TEMP_PASSWORD_LENGTH } from "@/lib/temp-password";

describe("makeTempPassword", () => {
  it("12자, 헷갈리는 글자 없이 영문과 숫자가 모두 들어간다", () => {
    for (let i = 0; i < 200; i++) {
      const p = makeTempPassword();
      expect(p).toHaveLength(TEMP_PASSWORD_LENGTH);
      expect(p).toMatch(/^[a-km-np-zA-HJ-NP-Z2-9]+$/);
      expect(p).toMatch(/[a-zA-Z]/);
      expect(p).toMatch(/[0-9]/);
    }
  });
  it("매번 다르다", () => {
    expect(new Set(Array.from({ length: 50 }, () => makeTempPassword())).size).toBe(50);
  });
  it("범위를 넘는 난수는 버리고, 숫자만 나온 묶음은 다시 만든다", () => {
    // 첫 값은 버려지는 큰 값, 그다음 12개는 모두 숫자 '2'(인덱스 48), 그다음은 'a'와 '2'가 섞인다
    const values = [0xffffffff, ...Array(12).fill(48), 0, ...Array(11).fill(48)];
    let i = 0;
    const p = makeTempPassword(() => new Uint32Array([values[i++]]));
    expect(p).toBe("a" + "2".repeat(11));
  });
});
