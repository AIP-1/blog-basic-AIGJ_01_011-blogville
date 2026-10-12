"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Fragment, useEffect, useRef } from "react";
import { FILE_ACCEPT, IMAGE_ACCEPT } from "@/lib/attachments";
import { FileCard, SiteImage } from "./FileCard";
import { useUpload } from "./useUpload";

type Props = {
  initialHtml: string;
  onChange: (html: string, text: string) => void;
  /** 첨부를 올리는 동안 true (발행 버튼을 막는다) */
  onUploadingChange?: (uploading: boolean) => void;
  /** 수정 중인 글 ID (새 글이면 null). 붙여 넣은 이 글의 첨부는 다시 올리지 않는다 */
  postId?: number | null;
};

export function RichEditor({ initialHtml, onChange, onUploadingChange, postId = null }: Props) {
  // 붙여 넣기·끌어다 놓기 처리가 만들어질 때는 아직 upload가 없어서 ref로 잇는다
  const uploadRef = useRef<(files: File[], at?: number) => void>(() => {});
  const pasteRef = useRef<(html: string) => void>(() => {});
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] },
      }),
      Placeholder.configure({ placeholder: "오늘 배운 것, 생각한 것, 무엇이든 적어 보세요 ✏️" }),
      SiteImage,
      FileCard,
    ],
    content: initialHtml,
    editorProps: {
      attributes: { "aria-label": "본문", class: "tiptap prose-post px-4 py-3" },
      handlePaste: (_view, event) => {
        const data = event.clipboardData;
        const html = data?.getData("text/html") ?? "";
        // 이 사이트의 사진·파일 카드가 든 HTML은 서버에 물어서 넣는다 (POST-07 흐름 7)
        if (/\/files\/[0-9a-f]{32}/.test(html)) {
          pasteRef.current(html);
          return true;
        }
        const files = data ? [...data.files] : [];
        // 엑셀·키노트처럼 글자와 그림을 함께 복사했으면 글자를 붙여 넣는다
        if (files.length === 0 || data?.getData("text/plain")) return false;
        uploadRef.current(files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = event.dataTransfer ? [...event.dataTransfer.files] : [];
        if (moved || files.length === 0) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        uploadRef.current(files, at);
        return true;
      },
    },
    onCreate: ({ editor }) => onChange(editor.getHTML(), editor.getText()),
    onUpdate: ({ editor }) => onChange(editor.getHTML(), editor.getText()),
  });

  const { upload, pasteHtml, progress, problems, dismiss } = useUpload(editor, (busy) => onUploadingChange?.(busy), postId);
  useEffect(() => {
    uploadRef.current = upload;
    pasteRef.current = pasteHtml;
  }, [upload, pasteHtml]);

  return (
    <div className="rounded-xl border border-line bg-surface" data-editor-root>
      {editor && <Toolbar editor={editor} uploading={progress !== null} onPick={upload} />}
      {(progress || problems.length > 0) && (
        <div className="space-y-1 border-b border-line px-3 py-2 text-sm">
          {progress && <p role="status">{progress.total === 0 ? "붙여 넣는 중..." : `올리는 중... (${progress.done}/${progress.total})`}</p>}
          {problems.map((p) => (
            <p key={p.id} role="alert" className="form-error flex items-start justify-between gap-2">
              <span>
                {p.name}: {p.message}
              </span>
              <button type="button" className="shrink-0 px-1" aria-label="문구 닫기" onClick={() => dismiss(p.id)}>
                ✕
              </button>
            </p>
          ))}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

type Tool = { label: string; title: string; run: () => void; active?: boolean; disabled?: boolean; className?: string };

/** 명세 POST-01 에디터 도구 순서: 제목 | 글자 꾸미기 | 덩어리 | 되돌리기 | 첨부 */
function Toolbar({ editor, uploading, onPick }: { editor: Editor; uploading: boolean; onPick: (files: File[]) => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      code: e.isActive("codeBlock"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  // 비우거나 `https://`만 남기면 링크를 푼다 (깨진 링크를 만들지 않는다)
  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 주소 (비우면 링크 해제)", previous ?? "https://");
    if (url === null) return;
    const href = url.trim();
    if (href === "" || href === "https://") editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };

  const chain = () => editor.chain().focus();
  const groups: Tool[][] = [
    [
      { label: "H2", title: "큰 제목", active: state.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
      { label: "H3", title: "작은 제목", active: state.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
    ],
    [
      { label: "B", title: "굵게", active: state.bold, run: () => chain().toggleBold().run(), className: "font-bold" },
      { label: "I", title: "기울임", active: state.italic, run: () => chain().toggleItalic().run(), className: "italic" },
      { label: "U", title: "밑줄", active: state.underline, run: () => chain().toggleUnderline().run(), className: "underline" },
      { label: "S", title: "취소선", active: state.strike, run: () => chain().toggleStrike().run(), className: "line-through" },
    ],
    [
      { label: "•", title: "글머리 목록", active: state.bullet, run: () => chain().toggleBulletList().run() },
      { label: "1.", title: "번호 목록", active: state.ordered, run: () => chain().toggleOrderedList().run() },
      { label: "❝", title: "인용", active: state.quote, run: () => chain().toggleBlockquote().run() },
      { label: "</>", title: "코드 블록", active: state.code, run: () => chain().toggleCodeBlock().run() },
      { label: "―", title: "구분선", run: () => chain().setHorizontalRule().run() },
      { label: "🔗", title: "링크", active: state.link, run: setLink },
    ],
    [
      { label: "↶", title: "되돌리기", disabled: !state.canUndo, run: () => chain().undo().run() },
      { label: "↷", title: "다시 실행", disabled: !state.canRedo, run: () => chain().redo().run() },
    ],
  ];

  return (
    <div role="toolbar" aria-label="글 꾸미기" className="flex flex-wrap items-center gap-1 border-b border-line p-1">
      {groups.map((tools, i) => (
        <Fragment key={tools[0].title}>
          {i > 0 && <span role="separator" aria-orientation="vertical" className="mx-0.5 h-6 w-px bg-line" />}
          {tools.map((b) => (
            <button
              key={b.title}
              type="button"
              title={b.title}
              aria-label={b.title}
              aria-pressed={b.active}
              disabled={b.disabled}
              onClick={b.run}
              className={`btn px-2 font-mono ${b.active ? "btn-current" : "btn-ghost"} ${b.className ?? ""}`}
            >
              {b.label}
            </button>
          ))}
        </Fragment>
      ))}
      <span role="separator" aria-orientation="vertical" className="mx-0.5 h-6 w-px bg-line" />
      <UploadButton label="🖼 사진" title="사진 올리기 (PNG·JPG·GIF·WEBP, 10MB까지)" accept={IMAGE_ACCEPT} disabled={uploading} onPick={onPick} />
      <UploadButton label="📎 파일" title="파일 올리기 (PDF·한글·오피스·ZIP 등, 30MB까지)" accept={FILE_ACCEPT} disabled={uploading} onPick={onPick} />
    </div>
  );
}

function UploadButton(props: { label: string; title: string; accept: string; disabled: boolean; onPick: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" title={props.title} disabled={props.disabled} onClick={() => input.current?.click()} className="btn btn-ghost px-2">
        {props.label}
      </button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={props.accept}
        aria-label={props.title}
        onChange={(e) => {
          props.onPick([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </>
  );
}
