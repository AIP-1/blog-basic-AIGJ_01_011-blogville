"use client";

import { extensionOf, IMAGE_MAX_BYTES } from "@/lib/attachments";

/** 줄일 때 긴 쪽 최대 크기 (px). 글 화면은 이보다 좁다 */
const LONG_SIDE_MAX = 3200;

/**
 * 10MB가 넘는 사진(PNG·JPG·WEBP)을 브라우저에서 줄여 JPG로 바꾼다 (휴대폰·카메라 원본 사진).
 * GIF(움직이는 그림)·한도 안 사진·줄이지 못한 사진은 그대로 돌려준다 → 그다음 한도 검사가 알린다.
 */
export async function shrinkImage(file: File): Promise<File> {
  const ext = extensionOf(file.name);
  if (file.size <= IMAGE_MAX_BYTES || !["png", "jpg", "jpeg", "webp"].includes(ext)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    try {
      for (const [side, quality] of [
        [LONG_SIDE_MAX, 0.85],
        [2400, 0.8],
        [1600, 0.75],
      ] as const) {
        const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return file;
        // 투명한 곳은 흰 바탕으로 (JPG는 투명을 못 담는다)
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
        if (blob && blob.size <= IMAGE_MAX_BYTES) {
          const base = file.name.slice(0, file.name.length - ext.length - 1) || "사진";
          return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
        }
      }
      return file;
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}
