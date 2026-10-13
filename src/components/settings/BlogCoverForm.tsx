"use client";

import { useRef, useState } from "react";
import { deleteBlogCover, saveBlogCover, type CoverState } from "@/app/settings/blog/actions";
import { ATTACH_MESSAGES, IMAGE_ACCEPT, attachmentProblem, typeOf } from "@/lib/attachments";

/**
 * 블로그 관리의 커버 사진 (블로그 꾸미기): 프로필 사진(ProfilePhotoForm)과 같은 흐름.
 * [커버 사진 고르기]로 올리면(`/api/uploads`) 바로 블로그 홈 맨 위 사진이 되고, [커버 지우기]는 확인 뒤 비운다.
 */
export function BlogCoverForm({ coverKey }: { coverKey: string | null }) {
  const [state, setState] = useState<CoverState>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    const type = typeOf(file.name);
    const problem = !type || type.kind !== "image" ? ATTACH_MESSAGES.notImage : attachmentProblem(file.name, file.size);
    if (problem) return setState({ error: problem });
    setBusy(true);
    setState(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { key?: string; error?: string };
      if (!res.ok || !json.key) return setState({ error: json.error ?? ATTACH_MESSAGES.failed });
      const form = new FormData();
      form.append("key", json.key);
      setState(await saveBlogCover(form));
    } catch {
      setState({ error: ATTACH_MESSAGES.failed });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      {coverKey ? (
        // eslint-disable-next-line @next/next/no-img-element -- 권한을 확인하는 /files 주소라 next/image 최적화를 거치지 않는다
        <img src={`/files/${coverKey}?w=640`} alt="지금 커버 사진" className="aspect-[4/1] w-full rounded-xl border border-line object-cover" data-cover-preview />
      ) : (
        <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-ink-soft">아직 커버 사진이 없어요</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className={`btn ${busy ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
          {busy ? "올리는 중..." : "🖼️ 커버 사진 고르기"}
          <input
            ref={input}
            type="file"
            accept={IMAGE_ACCEPT}
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </label>
        {coverKey && (
          <form
            action={async () => {
              if (busy || !window.confirm("커버 사진을 지울까요?")) return;
              setBusy(true);
              try {
                setState(await deleteBlogCover());
              } finally {
                setBusy(false);
              }
            }}
          >
            <button type="submit" className="btn" disabled={busy}>
              커버 지우기
            </button>
          </form>
        )}
      </div>
      <p className="text-sm text-ink-soft">PNG·JPG·GIF·WEBP 사진, 10MB까지. 블로그 홈 맨 위에 가로로 길게 보여요.</p>
      {state && "error" in state && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      {state && "message" in state && (
        <p role="status" className="font-semibold text-accent">
          {state.message}
        </p>
      )}
    </div>
  );
}
