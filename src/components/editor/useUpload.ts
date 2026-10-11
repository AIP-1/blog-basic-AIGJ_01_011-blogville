"use client";

import type { Editor } from "@tiptap/react";
import { useCallback, useRef, useState } from "react";
import { ATTACH_MESSAGES, attachmentProblem } from "@/lib/attachments";

export type UploadProblem = { id: number; name: string; message: string };
type Uploaded = { url: string; kind: "image" | "file"; name: string; size: number; sizeLabel: string; ext: string };

/**
 * 사진·파일을 한 개씩 차례로 올리고 받은 주소를 에디터에 넣는다 (POST-07 흐름 2~4).
 * 넣을 자리는 올리는 동안 글을 고쳐도 따라간다.
 */
export function useUpload(editor: Editor | null, onBusyChange: (busy: boolean) => void) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [problems, setProblems] = useState<UploadProblem[]>([]);
  const busy = useRef(false);
  const nextId = useRef(0);

  const addProblem = useCallback((name: string, message: string) => {
    setProblems((list) => [...list, { id: nextId.current++, name, message }]);
  }, []);

  const upload = useCallback(
    async (files: File[], at?: number) => {
      if (!editor || files.length === 0) return;
      if (busy.current) {
        addProblem(files[0].name, ATTACH_MESSAGES.busy);
        return;
      }
      const ok = files.filter((f) => {
        const problem = attachmentProblem(f.name, f.size);
        if (problem) addProblem(f.name, problem);
        return !problem;
      });
      if (ok.length === 0) return;

      busy.current = true;
      onBusyChange(true);
      let pos = at ?? editor.state.selection.to;
      let own = false;
      // 남이(회원이) 고친 만큼만 넣을 자리를 옮긴다. 내가 넣은 것은 아래에서 직접 계산한다.
      const follow = ({ transaction }: { transaction: { mapping: { map: (p: number) => number } } }) => {
        if (!own) pos = transaction.mapping.map(pos);
      };
      const mine = (run: () => void) => {
        own = true;
        try {
          run();
        } finally {
          own = false;
        }
      };
      /** 문단 안이면 문단 경계로 옮긴다 (가운데면 문단을 나눈다) */
      const toBoundary = (p: number) => {
        const $p = editor.state.doc.resolve(Math.min(p, editor.state.doc.content.size));
        if (!$p.parent.isTextblock) return $p.pos;
        if ($p.parentOffset === 0) return $p.before();
        if ($p.parentOffset === $p.parent.content.size) return $p.after();
        mine(() => editor.chain().setTextSelection($p.pos).splitBlock().run());
        return $p.pos + 1;
      };
      editor.on("transaction", follow);
      try {
        for (let i = 0; i < ok.length; i++) {
          setProgress({ done: i + 1, total: ok.length });
          const file = ok[i];
          let result: Uploaded;
          try {
            const body = new FormData();
            body.set("file", file);
            const res = await fetch("/api/uploads", { method: "POST", body });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              addProblem(file.name, json.error ?? ATTACH_MESSAGES.failed);
              continue;
            }
            result = json;
          } catch {
            addProblem(file.name, ATTACH_MESSAGES.failed);
            continue;
          }
          const node =
            result.kind === "image"
              ? { type: "image", attrs: { src: result.url, alt: "" } }
              : { type: "fileCard", attrs: { href: result.url, name: result.name, size: String(result.size), sizeLabel: result.sizeLabel, ext: result.ext } };
          const at = toBoundary(pos);
          mine(() => editor.chain().insertContentAt(at, node, { updateSelection: false }).run());
          pos = at + 1; // 사진·파일 카드는 크기 1인 atom 노드
        }
        // 마지막으로 넣은 것 뒤 글자 자리로 커서를 옮겨 바로 이어 쓰게 한다 (뒤에 문단이 없으면 만든다)
        const end = Math.min(pos, editor.state.doc.content.size);
        mine(() => {
          if (!editor.state.doc.resolve(end).nodeAfter?.isTextblock) editor.chain().insertContentAt(end, { type: "paragraph" }).run();
          editor.chain().focus().setTextSelection(end + 1).run();
        });
      } finally {
        editor.off("transaction", follow);
        busy.current = false;
        setProgress(null);
        onBusyChange(false);
      }
    },
    [editor, addProblem, onBusyChange],
  );

  const dismiss = useCallback((id: number) => setProblems((list) => list.filter((p) => p.id !== id)), []);

  return { upload, progress, problems, dismiss };
}
