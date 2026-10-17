"use client";

import { useId, useState, useTransition } from "react";
import { leaveTownNote } from "@/app/town/actions";
import { emitTown } from "@/lib/town/events";
import { TOWN_NOTE_MAX } from "@/lib/town/plaza";

/**
 * 우체통 쪽지 넣기 (plaza-upgrade-2, B3): 이웃 집 우체통 창(PC 광장)과 휴대폰 광장의 이웃 시트가 같이 쓴다.
 * [✉️ 쪽지 넣기]를 누르면 글 칸(1~200자)과 🔒 비밀 체크가 열리고, 보내면 그 블로그 방명록에 글이 남는다(`leaveTownNote`, 주인에게 알림).
 * 마을을 다시 그리지 않고 결과만 받아 '쪽지를 넣었어요 ✓'로 바뀐다. 보낸 뒤 window 이벤트 `bv-note` {lot}을 쏘아 게임이 그 우체통 깃발을 잠깐 든다.
 * 글 칸에 쓰는 동안 키는 게임으로 가지 않는다 (창이 열려 있으면 게임은 키보드를 쓰지 않는다). 시험 훅 `data-mailbox-note`(idle|open|sent).
 */
export function MailboxNote({ slug, lot }: { slug: string; lot: number }) {
  const [state, setState] = useState<"idle" | "open" | "sent">("idle");
  const [content, setContent] = useState("");
  const [secret, setSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const id = useId();
  const length = [...content].length;

  if (state === "sent") {
    return (
      <div className="flex flex-wrap items-center gap-2" data-mailbox-note="sent">
        <p role="status" className="font-semibold">
          쪽지를 넣었어요 ✓
        </p>
        <button
          type="button"
          className="px-btn px-btn--quiet px-btn--sm"
          onClick={() => {
            setContent("");
            setSecret(false);
            setState("open");
          }}
        >
          한 장 더 쓰기
        </button>
      </div>
    );
  }

  if (state === "idle") {
    return (
      <div data-mailbox-note="idle">
        <button type="button" className="px-btn px-btn--sm" onClick={() => setState("open")}>
          ✉️ 쪽지 넣기
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-2"
      data-mailbox-note="open"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        start(async () => {
          const result = await leaveTownNote(slug, content, secret);
          if ("error" in result) {
            setError(result.error);
            return;
          }
          setState("sent");
          emitTown("bv-note", { lot });
        });
      }}
    >
      <label htmlFor={`${id}-note`} className="block text-sm font-bold">
        ✉️ 쪽지 (방명록에 남아요)
      </label>
      <textarea
        id={`${id}-note`}
        // 창을 열자마자 바로 쓴다
        autoFocus
        required
        rows={3}
        maxLength={TOWN_NOTE_MAX * 2}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        className="block w-full resize-none bg-(--kit-paper-2) px-2.5 py-2 text-sm text-(--kit-ink) shadow-[inset_0_0_0_2px_var(--kit-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--kit-ink)"
        placeholder="안부를 남겨 보세요"
        aria-describedby={`${id}-count`}
      />
      <div className="flex items-center gap-2 text-sm">
        <label className="flex min-h-11 items-center gap-1.5 font-semibold">
          <input type="checkbox" className="size-4 accent-(--accent)" checked={secret} onChange={(event) => setSecret(event.target.checked)} />
          🔒 비밀 쪽지
        </label>
        <span id={`${id}-count`} className={`ml-auto text-xs ${length > TOWN_NOTE_MAX ? "font-bold text-(--danger)" : "text-(--kit-ink-soft)"}`}>
          {length}/{TOWN_NOTE_MAX}자
        </span>
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-(--danger)">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2.5 p-0.5">
        <button type="submit" className="px-btn px-btn--primary px-btn--sm" disabled={pending || length === 0 || length > TOWN_NOTE_MAX}>
          {pending ? "넣는 중…" : "쪽지 넣기"}
        </button>
        <button type="button" className="px-btn px-btn--quiet px-btn--sm" onClick={() => setState("idle")}>
          그만두기
        </button>
      </div>
    </form>
  );
}
