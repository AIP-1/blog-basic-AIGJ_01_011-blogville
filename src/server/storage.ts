import "server-only";
import { createReadStream } from "node:fs";
import { constants, copyFile as copy, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { KEY_PATTERN } from "@/lib/attachments";

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
