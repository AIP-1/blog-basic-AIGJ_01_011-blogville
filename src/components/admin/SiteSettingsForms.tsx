"use client";

import { useState } from "react";
import { adminSaveBannedWords, adminSaveNotice } from "@/app/admin/tools-actions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { BANNED_MAX_WORDS, BANNED_WORD_MAX, NOTICE_LINK_MAX, NOTICE_MAX, type SiteNotice } from "@/lib/admin-rules";

/** 사이트 공지 띠 (ADM-04): 문구 1~200자, 이 사이트 안 링크(선택), 켜기·끄기. 칸은 상태로 쥐어 저장에 실패해도 쓴 내용이 남는다 */
export function NoticeForm({ notice }: { notice: SiteNotice | null }) {
  const [text, setText] = useState(notice?.text ?? "");
  const [link, setLink] = useState(notice?.link ?? "");
  const [enabled, setEnabled] = useState(notice?.enabled ?? false);
  return (
    <AdminActionForm action={adminSaveNotice} label="공지 띠" className="space-y-3">
      <div>
        <label htmlFor="notice-text" className="mb-1 block font-semibold">
          공지 문구{" "}
          <span className="text-sm font-normal text-ink-soft">
            ({text.length}/{NOTICE_MAX})
          </span>
        </label>
        <input id="notice-text" name="text" value={text} onChange={(e) => setText(e.target.value)} maxLength={NOTICE_MAX} required className="field" />
      </div>
      <div>
        <label htmlFor="notice-link" className="mb-1 block font-semibold">
          링크 <span className="text-sm font-normal text-ink-soft">(선택, 이 사이트 안 주소: 예 /@notice/12)</span>
        </label>
        <input
          id="notice-link"
          name="link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          maxLength={NOTICE_LINK_MAX}
          placeholder="/"
          className="field"
        />
      </div>
      <label className="flex min-h-11 items-center gap-2 font-semibold">
        <input type="checkbox" name="enabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-5" />
        모든 화면 위에 보이기
      </label>
      <button type="submit" className="btn btn-primary">
        공지 띠 저장
      </button>
    </AdminActionForm>
  );
}

/** 금지어 (ADM-05): 한 줄에 하나, 1~30자, 200개까지. 대소문자 없이 글자 안에 들어 있기만 해도 막는다 */
export function BannedWordsForm({ words }: { words: string[] }) {
  const [value, setValue] = useState(words.join("\n"));
  const count = value.split("\n").filter((l) => l.trim()).length;
  return (
    <AdminActionForm action={adminSaveBannedWords} label="금지어" className="space-y-3">
      <div>
        <label htmlFor="banned-words" className="mb-1 block font-semibold">
          금지어{" "}
          <span className="text-sm font-normal text-ink-soft">
            (한 줄에 하나, {BANNED_WORD_MAX}자까지 · {count}/{BANNED_MAX_WORDS}개)
          </span>
        </label>
        <textarea id="banned-words" name="words" rows={8} value={value} onChange={(e) => setValue(e.target.value)} className="field font-mono" />
      </div>
      <button type="submit" className="btn btn-primary">
        금지어 저장
      </button>
    </AdminActionForm>
  );
}
