import { describe, expect, it } from "vitest";
import { findArt } from "@/lib/art";
import { composeArt, walkDir, walkFrame, WALK_DIRS } from "@/lib/art/walk";

const boy = [findArt("char.boy")!];
const dressed = [findArt("char.boy")!, findArt("hat.straw")!];

describe("걷는 그림 (TOWN-17)", () => {
  it("모든 칸이 16×16, 앞모습 서 있기는 그냥 입은 그림과 같다", () => {
    for (const dir of WALK_DIRS) {
      for (let f = 0; f <= 4; f++) {
        const g = walkFrame(dressed, dir, f);
        expect(g).toHaveLength(16);
        for (const row of g) expect(row).toHaveLength(16);
      }
    }
    expect(walkFrame(dressed, "down", 0)).toEqual(composeArt(dressed));
  });
  it("오른쪽은 왼쪽의 좌우 반전, 2·4칸은 서 있기와 같다", () => {
    for (let f = 0; f <= 4; f++) expect(walkFrame(boy, "right", f)).toEqual(walkFrame(boy, "left", f).map((r) => [...r].reverse()));
    expect(walkFrame(boy, "down", 2)).toEqual(walkFrame(boy, "down", 0));
    expect(walkFrame(boy, "down", 4)).toEqual(walkFrame(boy, "down", 0));
  });
  it("1·3칸은 몸이 한 칸 올라가고(모자도 같이) 한쪽 발을 든다", () => {
    const idle = walkFrame(dressed, "down", 0);
    const one = walkFrame(dressed, "down", 1);
    const three = walkFrame(dressed, "down", 3);
    expect(one[0]).toEqual(idle[1]);
    expect(one[5]).toEqual(idle[6]);
    // 1칸은 왼발, 3칸은 오른발을 들어 맨 아래 줄이 그쪽만 비어 있다
    expect(one[15].slice(0, 8).every((c) => c === null)).toBe(true);
    expect(one[15].slice(8)).toEqual(idle[15].slice(8));
    expect(three[15].slice(8).every((c) => c === null)).toBe(true);
    expect(three[15].slice(0, 8)).toEqual(idle[15].slice(0, 8));
  });
  it("뒷모습에는 눈이 없고 머리색, 옆모습은 눈이 한 칸 앞으로", () => {
    const eye = "#2b2b2b";
    const up = walkFrame(boy, "up", 0);
    expect(up.flat().includes(eye)).toBe(false);
    const idle = walkFrame(boy, "down", 0);
    const left = walkFrame(boy, "left", 0);
    expect(idle[6].indexOf(eye)).toBe(5);
    expect(left[6].indexOf(eye)).toBe(4);
  });
  it("방향: 더 크게 움직이는 쪽, 멈추면 그대로", () => {
    expect(walkDir(-1, 0.5, "down")).toBe("left");
    expect(walkDir(0.3, -1, "down")).toBe("up");
    expect(walkDir(0, 1, "left")).toBe("down");
    expect(walkDir(0, 0, "left")).toBe("left");
  });
});
