"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

type Props = {
  initialHtml: string;
  onChange: (html: string, text: string) => void;
};

export function RichEditor({ initialHtml, onChange }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] },
      }),
      Placeholder.configure({ placeholder: "오늘 배운 것, 생각한 것, 무엇이든 적어 보세요 ✏️" }),
    ],
    content: initialHtml,
    editorProps: { attributes: { "aria-label": "본문", class: "tiptap prose-post px-4 py-3" } },
    onCreate: ({ editor }) => onChange(editor.getHTML(), editor.getText()),
    onUpdate: ({ editor }) => onChange(editor.getHTML(), editor.getText()),
  });

  return (
    <div className="rounded-xl border border-line bg-surface">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      code: e.isActive("codeBlock"),
      link: e.isActive("link"),
    }),
  });

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 주소", previous ?? "https://");
    if (url === null) return;
    if (url.trim() === "") editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const buttons: { label: string; title: string; active: boolean; run: () => void }[] = [
    { label: "H2", title: "큰 제목", active: state.h2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "H3", title: "작은 제목", active: state.h3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: "B", title: "굵게", active: state.bold, run: () => editor.chain().focus().toggleBold().run() },
    { label: "I", title: "기울임", active: state.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { label: "•", title: "목록", active: state.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "1.", title: "번호 목록", active: state.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: "❝", title: "인용", active: state.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
    { label: "</>", title: "코드 블록", active: state.code, run: () => editor.chain().focus().toggleCodeBlock().run() },
    { label: "🔗", title: "링크", active: state.link, run: setLink },
    { label: "―", title: "구분선", active: false, run: () => editor.chain().focus().setHorizontalRule().run() },
  ];

  return (
    <div role="toolbar" aria-label="글 꾸미기" className="flex flex-wrap gap-1 border-b border-line p-1">
      {buttons.map((b) => (
        <button
          key={b.title}
          type="button"
          title={b.title}
          aria-label={b.title}
          aria-pressed={b.active}
          onClick={b.run}
          className={`btn px-2 font-mono ${b.active ? "btn-selected" : "btn-ghost"}`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
