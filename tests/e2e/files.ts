import { deflateSync, crc32 } from "node:zlib";
import type { Page } from "@playwright/test";

/** w×h 크기의 진짜 PNG (회색) */
export function makePng(w = 4, h = 4): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // 8비트
  ihdr[9] = 0; // 흑백
  const rows = Buffer.alloc((w + 1) * h, 0x99);
  for (let y = 0; y < h; y++) rows[y * (w + 1)] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export const PDF = Buffer.from("%PDF-1.4\n% 시험용\n%%EOF\n");

export type FileSpec = { name: string; mimeType: string; buffer: Buffer };
export const png = (name = "사진.png", w = 4, h = 4): FileSpec => ({ name, mimeType: "image/png", buffer: makePng(w, h) });

/** 본문에 파일을 붙여 넣거나 끌어다 놓는다 (브라우저 이벤트를 직접 만든다) */
export async function dispatchFiles(page: Page, how: "paste" | "drop", files: FileSpec[], html?: string) {
  await page.locator(".tiptap").evaluate(
    (el, { how, files, html }) => {
      const dt = new DataTransfer();
      for (const f of files) dt.items.add(new File([new Uint8Array(f.bytes)], f.name, { type: f.mimeType }));
      if (html) dt.setData("text/html", html);
      if (how === "paste") {
        el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
      } else {
        const r = el.getBoundingClientRect();
        el.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, clientX: r.left + 20, clientY: r.top + 20, bubbles: true, cancelable: true }));
      }
    },
    { how, html, files: files.map((f) => ({ name: f.name, mimeType: f.mimeType, bytes: [...f.buffer] })) },
  );
}

/** 브라우저 쿠키로 /api/uploads에 직접 보낸다 */
export async function uploadDirect(page: Page, file: FileSpec, origin: string | null = new URL(page.url()).origin) {
  const headers: Record<string, string> = {};
  if (origin) headers.origin = origin;
  const res = await page.request.post("/api/uploads", { headers, multipart: { file } });
  return { status: res.status(), json: await res.json().catch(() => ({})) };
}
