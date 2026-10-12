import { describe, expect, it } from "vitest";
import {
  ATTACH_MESSAGES as M,
  attachmentAccess,
  attachmentProblem,
  cleanFileName,
  contentDisposition,
  extractFileKeys,
  formatBytes,
  keyFromUrl,
  pasteAction,
  sniffImage,
  typeOf,
} from "@/lib/attachments";

const KEY = "0123456789abcdef0123456789abcdef";
const MB = 1024 * 1024;

describe("typeOf·attachmentProblem (FR-001·002)", () => {
  it("확장자로 종류를 정한다", () => {
    expect(typeOf("a.PNG")).toMatchObject({ kind: "image", mime: "image/png" });
    expect(typeOf("보고서.hwp")).toMatchObject({ kind: "file", ext: "hwp" });
    expect(typeOf("x.svg")).toBeNull();
    expect(typeOf("x.exe")).toBeNull();
    expect(typeOf("noext")).toBeNull();
  });
  it.each([
    ["x.svg", 10, M.badType],
    ["x.html", 10, M.badType],
    ["x.png", 0, M.empty],
    ["x.png", 10 * MB, null],
    ["x.png", 10 * MB + 1, M.imageTooBig],
    ["x.pdf", 30 * MB, null],
    ["x.pdf", 30 * MB + 1, M.fileTooBig],
  ])("%s %d바이트 → %s", (name, size, expected) => expect(attachmentProblem(name, size)).toBe(expected));
});

describe("sniffImage", () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, ...Array(12).fill(0)].slice(0, 12));
  it("진짜 사진은 통과", () => {
    expect(sniffImage("png", bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(true);
    expect(sniffImage("jpg", bytes(0xff, 0xd8, 0xff, 0xe0))).toBe(true);
    expect(sniffImage("gif", new TextEncoder().encode("GIF89a......"))).toBe(true);
    expect(sniffImage("webp", new TextEncoder().encode("RIFF\0\0\0\0WEBP"))).toBe(true);
  });
  it("확장자만 바꾼 SVG·HTML·다른 사진 형식은 거부", () => {
    expect(sniffImage("png", new TextEncoder().encode("<svg xmlns=."))).toBe(false);
    expect(sniffImage("png", new TextEncoder().encode("<html><body>"))).toBe(false);
    expect(sniffImage("jpg", new TextEncoder().encode("RIFF\0\0\0\0WEBP"))).toBe(false);
  });
});

describe("cleanFileName·formatBytes·contentDisposition", () => {
  it("경로와 제어 문자를 뺀다", () => {
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
    expect(cleanFileName("C:\\x\\보고서\u0007.pdf")).toBe("보고서.pdf");
  });
  it("255자가 넘으면 확장자를 남기고 줄인다", () => {
    const name = cleanFileName("가".repeat(300) + ".pdf");
    expect([...name]).toHaveLength(255);
    expect(name.endsWith(".pdf")).toBe(true);
  });
  it.each([
    [45, "45B"],
    [340 * 1024, "340KB"],
    [1.2 * MB, "1.2MB"],
  ])("%d → %s", (size, label) => expect(formatBytes(size)).toBe(label));
  it("한글·따옴표·괄호 이름을 filename*로", () => {
    const value = contentDisposition("file", `철수's "발표" (최종).pdf`);
    expect(value).toContain(`filename="__'s ____ (__).pdf"`);
    expect(value).toContain("filename*=UTF-8''%EC%B2%A0%EC%88%98%27s%20%22%EB%B0%9C%ED%91%9C%22%20%28%EC%B5%9C%EC%A2%85%29.pdf");
    expect(contentDisposition("image", "a.png")).toBe("inline");
  });
});

describe("keyFromUrl·extractFileKeys", () => {
  it("이 사이트 /files/키만", () => {
    expect(keyFromUrl(`/files/${KEY}`)).toBe(KEY);
    expect(keyFromUrl(`https://evil.example/files/${KEY}`)).toBeNull();
    expect(keyFromUrl(`/files/${KEY}/x`)).toBeNull();
    expect(keyFromUrl(undefined)).toBeNull();
  });
  it("본문의 키를 중복 없이 정렬해서", () => {
    const b = "f".repeat(32);
    const html = `<img src="/files/${b}"><a href="/files/${KEY}" data-file></a><img src='/files/${b}'>`;
    expect(extractFileKeys(html)).toEqual([KEY, b]);
  });
});

describe("attachmentAccess (FR-007)", () => {
  const base = { uploaderId: "u1", postId: 1, postIsPublic: true, blogOwnerId: "u1" };
  it("공개 글은 누구나", () => expect(attachmentAccess(base, null)).toBe(true));
  it("비공개 글은 블로그 주인만", () => {
    const a = { ...base, postIsPublic: false };
    expect(attachmentAccess(a, "u1")).toBe(true);
    expect(attachmentAccess(a, "u2")).toBe(false);
    expect(attachmentAccess(a, null)).toBe(false);
  });
  it("붙지 않은 첨부는 올린 사람만", () => {
    const a = { uploaderId: "u1", postId: null, postIsPublic: null, blogOwnerId: null };
    expect(attachmentAccess(a, "u1")).toBe(true);
    expect(attachmentAccess(a, "u2")).toBe(false);
    expect(attachmentAccess(a, null)).toBe(false);
  });
});

describe("pasteAction (POST-07 흐름 7)", () => {
  const mine = (postId: number | null) => ({ uploaderId: "me", postId });
  it("없는 키·남의 것은 넣지 않는다", () => {
    expect(pasteAction(undefined, "me", null)).toBe("drop");
    expect(pasteAction({ uploaderId: "you", postId: null }, "me", null)).toBe("drop");
    expect(pasteAction({ uploaderId: "you", postId: 3 }, "me", 3)).toBe("drop");
  });
  it("내 것이고 안 붙었거나 이 글 것이면 그대로", () => {
    expect(pasteAction(mine(null), "me", null)).toBe("keep");
    expect(pasteAction(mine(null), "me", 7)).toBe("keep");
    expect(pasteAction(mine(7), "me", 7)).toBe("keep");
  });
  it("내 다른 글 것이면 다시 올린다 (새 글에서도)", () => {
    expect(pasteAction(mine(3), "me", 7)).toBe("reupload");
    expect(pasteAction(mine(3), "me", null)).toBe("reupload");
  });
});
