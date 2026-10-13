import "server-only";
import { createReadStream } from "node:fs";
import { constants, copyFile as copy, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { KEY_PATTERN, THUMB_WIDTHS, type ThumbWidth } from "@/lib/attachments";

// 첨부 파일 저장소 (FR-010). 지금은 서버 디스크. 다른 저장소로 옮기면 이 파일만 바꾼다.
const ROOT = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.UPLOAD_DIR ?? "storage/uploads");

function pathOf(key: string) {
  if (!KEY_PATTERN.test(key)) throw new Error("잘못된 첨부 키");
  return path.join(ROOT, key);
}

export async function saveFile(key: string, data: Uint8Array) {
  await mkdir(ROOT, { recursive: true });
  await writeFile(pathOf(key), data, { flag: "wx" });
}

/** 저장된 파일을 새 키로 복사한다. 새 키가 이미 있으면 실패한다. */
export async function copyFile(from: string, to: string) {
  await copy(pathOf(from), pathOf(to), constants.COPYFILE_EXCL);
}

/** 파일 스트림. 없으면 null. */
export async function openFile(key: string): Promise<{ stream: ReadableStream; size: number } | null> {
  const file = pathOf(key);
  try {
    const info = await stat(file);
    return { stream: Readable.toWeb(createReadStream(file)) as ReadableStream, size: info.size };
  } catch {
    return null;
  }
}

export async function deleteFile(key: string) {
  await rm(pathOf(key), { force: true });
  await Promise.all(THUMB_WIDTHS.map((w) => rm(thumbPathOf(key, w), { force: true })));
}

// 썸네일은 원본 옆 thumbs/ 폴더에 둔다 (원본 키가 아니라 정리 작업 목록에 안 잡힌다)
const THUMB_DIR = path.join(ROOT, "thumbs");

function thumbPathOf(key: string, width: ThumbWidth) {
  if (!KEY_PATTERN.test(key)) throw new Error("잘못된 첨부 키");
  return path.join(THUMB_DIR, `${key}-${width}.webp`);
}

/**
 * 사진 썸네일(webp). 처음 한 번 만들어 저장해 두고 다음부터 그 파일을 준다.
 * 원본이 없거나 사진으로 읽히지 않으면 null (부르는 쪽이 원본을 준다).
 */
export async function openThumb(key: string, width: ThumbWidth): Promise<{ data: Uint8Array; size: number } | null> {
  const file = thumbPathOf(key, width);
  try {
    const data = await readFile(file);
    return { data, size: data.byteLength };
  } catch {
    // 아직 없다 → 만든다
  }
  try {
    const { default: sharp } = await import("sharp");
    const data = await sharp(pathOf(key), { failOn: "error" })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    await mkdir(THUMB_DIR, { recursive: true });
    // 같은 썸네일을 동시에 만들어도 내용이 같다. 임시 이름에 쓰고 옮겨서 반쯤 쓴 파일을 주지 않는다
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, data);
    await rename(tmp, file);
    return { data, size: data.byteLength };
  } catch {
    return null;
  }
}

/** 저장소의 모든 파일 (정리 작업용) */
export async function listFiles(): Promise<{ key: string; modifiedAt: Date }[]> {
  let names: string[];
  try {
    names = await readdir(ROOT);
  } catch {
    return [];
  }
  const files = await Promise.all(
    names.filter((n) => KEY_PATTERN.test(n)).map(async (key) => ({ key, modifiedAt: (await stat(pathOf(key))).mtime })),
  );
  return files;
}
