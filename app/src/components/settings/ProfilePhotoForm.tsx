"use client";

import { useRef, useState } from "react";
import { deleteProfilePhoto, saveProfilePhoto, type PhotoState } from "@/app/settings/account/actions";
import { ATTACH_MESSAGES, IMAGE_ACCEPT, attachmentProblem, typeOf } from "@/lib/attachments";
import { ProfileAvatar } from "../profile/ProfileAvatar";

/**
 * 내 정보의 프로필 사진 (BLOG-03): [사진 고르기]로 사진을 올리면(`/api/uploads`, 글쓰기와 같은 규칙) 바로 프로필 사진이 된다.
 * [사진 지우기]는 확인 뒤 비운다. 결과는 아래 한 줄로 알린다.
 */
export function ProfilePhotoForm({ photoKey, nickname }: { photoKey: string | null; nickname: string }) {
  const [state, setState] = useState<PhotoState>(null);
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
      setState(await saveProfilePhoto(form));
    } catch {
      setState({ error: ATTACH_MESSAGES.failed });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <ProfileAvatar photoKey={photoKey} nickname={nickname} size={72} />
      <div className="flex flex-wrap items-center gap-2">
        <label className={`btn ${busy ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
          {busy ? "올리는 중..." : "📷 사진 고르기"}
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
        {photoKey && (
          <form
            action={async () => {
              if (busy || !window.confirm("프로필 사진을 지울까요?")) return;
              setBusy(true);
              try {
                setState(await deleteProfilePhoto());
              } finally {
                setBusy(false);
              }
            }}
          >
            <button type="submit" className="btn" disabled={busy}>
              사진 지우기
            </button>
          </form>
        )}
      </div>
      <p className="basis-full text-sm text-ink-soft">PNG·JPG·GIF·WEBP 사진, 10MB까지. 블로그 홈 이름 옆에 보여요.</p>
      {state && "error" in state && (
        <p role="alert" className="form-error basis-full">
          {state.error}
        </p>
      )}
      {state && "message" in state && (
        <p role="status" className="basis-full font-semibold text-accent">
          {state.message}
        </p>
      )}
    </div>
  );
}
