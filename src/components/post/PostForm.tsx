"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { savePost, type PostFormState } from "@/app/write/actions";
import { clearDraft, DRAFT_ASK, DRAFT_DELAY_MS, DRAFT_HINT, isEmptyDraft, readDraft, savedLabel, writeDraft } from "@/lib/draft";
import { checkPostInput, CONTENT_BYTES_MAX, POST_ERRORS, TAGS_MAX_CHARS, TITLE_MAX, utf8Bytes } from "@/lib/post-rules";
import { postTextLength } from "@/lib/text-length";
import { RichEditor } from "../editor/RichEditor";

export type CategoryOption = { id: number; name: string; subs: { id: number; name: string }[] };

type Props = {
  categories: CategoryOption[];
  initial?: {
    postId: number;
    title: string;
    contentHtml: string;
    categoryId: number | null;
    subcategoryId: number | null;
    isPublic: boolean;
    tags: string[];
  };
  /** 새 글 화면만: 이 회원의 임시 글을 이 브라우저에 저장하고 불러온다 (POST-08) */
  draftOwnerId?: string;
};

type Start = {
  title: string;
  contentHtml: string;
  categoryId: string;
  subcategoryId: string;
  visibility: "public" | "private";
  tags: string;
};

const EMPTY: Start = { title: "", contentHtml: "", categoryId: "", subcategoryId: "", visibility: "public", tags: "" };

export function PostForm({ categories, initial, draftOwnerId }: Props) {
  const [start, setStart] = useState<Start | null>(draftOwnerId ? null : EMPTY);

  // 그린 뒤에 임시 글을 읽고 한 번 묻는다. 고른 값으로 에디터를 처음부터 만들기 위해 그때까지 폼을 그리지 않는다.
  useEffect(() => {
    if (!draftOwnerId) return;
    const timer = setTimeout(() => {
      const draft = readDraft(draftOwnerId);
      if (!draft || !window.confirm(DRAFT_ASK)) return setStart(EMPTY);
      // 그 사이 지워진 대분류·소분류는 비운다 (BLOG-05)
      const category = categories.find((c) => c.id === draft.categoryId);
      const sub = category?.subs.find((s) => s.id === draft.subcategoryId);
      setStart({
        title: draft.title,
        contentHtml: draft.contentHtml,
        categoryId: category ? String(category.id) : "",
        subcategoryId: sub ? String(sub.id) : "",
        visibility: draft.visibility,
        tags: draft.tags,
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [draftOwnerId, categories]);

  if (!start) return <div aria-busy="true" aria-label="글쓰기 준비 중" className="min-h-96" />;
  return <Form categories={categories} initial={initial} draftOwnerId={draftOwnerId} start={start} />;
}

function Form({ categories, initial, draftOwnerId, start }: Props & { start: Start }) {
  const [state, action] = useActionState<PostFormState, FormData>(savePost, null);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(initial?.title ?? start.title);
  const [contentHtml, setContentHtml] = useState(initial?.contentHtml ?? start.contentHtml);
  const [contentText, setContentText] = useState("");
  // 아래 `N자`: 서버가 저장할 본문 글자 수와 같은 규칙 (POST-01)
  const charCount = useMemo(() => postTextLength(contentHtml), [contentHtml]);
  const [categoryId, setCategoryId] = useState(initial ? (initial.categoryId ? String(initial.categoryId) : "") : start.categoryId);
  const [subcategoryId, setSubcategoryId] = useState(initial ? (initial.subcategoryId ? String(initial.subcategoryId) : "") : start.subcategoryId);
  const [visibility, setVisibility] = useState<"public" | "private">(initial ? (initial.isPublic ? "public" : "private") : start.visibility);
  // 수정 화면은 저장된 태그를 이름순으로 `, `로 이어 채운다 (POST-04)
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? start.tags);
  const [localError, setLocalError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // 임시 저장 (POST-08): 처음 값과 에디터가 만들어질 때의 onChange는 "바뀜"이 아니다
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dirty = useRef(false);
  const editorReady = useRef(false);
  const stopped = useRef(false);
  const submitted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ title, contentHtml, contentText, categoryId, subcategoryId, visibility, tags });
  useEffect(() => {
    latest.current = { title, contentHtml, contentText, categoryId, subcategoryId, visibility, tags };
  });

  const flushDraft = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!draftOwnerId || stopped.current || !dirty.current) return;
    const v = latest.current;
    if (isEmptyDraft(v.title, v.contentText)) return;
    const now = Date.now();
    const ok = writeDraft(draftOwnerId, {
      title: v.title,
      categoryId: v.categoryId ? Number(v.categoryId) : null,
      subcategoryId: v.subcategoryId ? Number(v.subcategoryId) : null,
      visibility: v.visibility,
      contentHtml: v.contentHtml,
      tags: v.tags,
      savedAt: now,
    });
    if (ok) setSavedAt(now);
  }, [draftOwnerId]);

  useEffect(() => {
    if (!draftOwnerId || !dirty.current || stopped.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flushDraft, DRAFT_DELAY_MS);
  }, [draftOwnerId, flushDraft, title, contentHtml, categoryId, subcategoryId, visibility, tags]);

  // 발행에 성공하면 글 상세로 이동하며 이 화면이 사라진다: 그때 임시 글을 지운다
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (draftOwnerId && submitted.current) clearDraft(draftOwnerId);
    };
  }, [draftOwnerId]);

  // 발행이 오류로 끝나면 다시 저장한다
  useEffect(() => {
    if (state?.error) {
      stopped.current = false;
      submitted.current = false;
    }
  }, [state]);

  const touch = () => {
    dirty.current = true;
  };

  // 파일을 에디터 밖에 떨어뜨려도 브라우저가 그 파일을 열어 쓰던 글을 잃지 않게 한다 (POST-07)
  useEffect(() => {
    const guard = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      if ((e.target as Element | null)?.closest?.(".tiptap")) return;
      e.preventDefault();
    };
    window.addEventListener("dragover", guard);
    window.addEventListener("drop", guard);
    return () => {
      window.removeEventListener("dragover", guard);
      window.removeEventListener("drop", guard);
    };
  }, []);

  const subs = categories.find((c) => String(c.id) === categoryId)?.subs ?? [];
  const error = localError ?? state?.error;

  // 값은 모두 화면 상태에 두고 onSubmit에서 보낸다. 오류가 나도 입력이 남는다 (POST-01).
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (uploading) return;
    const raw = { postId: initial ? String(initial.postId) : "", title, contentHtml, categoryId, subcategoryId, visibility, tags };
    const checked = checkPostInput(raw);
    if (!checked.ok) return setLocalError(checked.error);
    if (utf8Bytes(contentHtml) > CONTENT_BYTES_MAX) return setLocalError(POST_ERRORS.tooLong);
    setLocalError(null);
    // 2초를 기다리지 않고 지금 내용을 쓰고, 결과가 나올 때까지 더 쓰지 않는다
    flushDraft();
    stopped.current = true;
    submitted.current = true;
    const formData = new FormData();
    Object.entries(raw).forEach(([k, v]) => formData.set(k, v));
    startTransition(() => action(formData));
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <input
        aria-label="제목"
        placeholder="제목"
        className="field text-2xl font-bold"
        maxLength={TITLE_MAX}
        value={title}
        onChange={(e) => {
          touch();
          setTitle(e.target.value);
        }}
      />

      <div className="flex flex-wrap gap-2">
        <select
          aria-label="대분류"
          className="field field-auto"
          value={categoryId}
          onChange={(e) => {
            touch();
            setCategoryId(e.target.value);
            setSubcategoryId("");
          }}
        >
          <option value="">카테고리 없음</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="소분류"
          className="field field-auto"
          value={subcategoryId}
          disabled={categoryId === ""}
          onChange={(e) => {
            touch();
            setSubcategoryId(e.target.value);
          }}
        >
          <option value="">소분류 없음</option>
          {subs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <RichEditor
        initialHtml={initial?.contentHtml ?? start.contentHtml}
        onChange={(html, text) => {
          if (editorReady.current) touch();
          editorReady.current = true;
          setContentHtml(html);
          setContentText(text);
        }}
        onUploadingChange={setUploading}
        postId={initial?.postId ?? null}
      />

      <input
        aria-label="태그"
        placeholder="태그 (쉼표로 구분, 최대 10개)  예: git, 회고"
        className="field"
        maxLength={TAGS_MAX_CHARS}
        value={tags}
        onChange={(e) => {
          touch();
          setTags(e.target.value);
        }}
      />

      <fieldset className="flex gap-2">
        <legend className="sr-only">공개 설정</legend>
        {(
          [
            ["public", "🌍 공개"],
            ["private", "🔒 비공개"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className={`btn cursor-pointer ${visibility === value ? "btn-selected" : ""}`}>
            <input type="radio" name="visibility" value={value} checked={visibility === value} onChange={() => {
                touch();
                setVisibility(value);
              }} className="sr-only" />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <p className="mr-auto text-sm text-ink-soft" data-char-count>
          {charCount.toLocaleString("ko-KR")}자{initial && " · 글을 고치고 있어요"}
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={pending || uploading}>
          {uploading ? "첨부를 올리는 중..." : pending ? "저장하는 중..." : initial ? "수정 완료" : "발행하기"}
        </button>
      </div>
      {draftOwnerId && (
        <p className="text-right text-sm text-ink-soft" aria-live="polite" data-draft-status>
          {savedAt ? savedLabel(savedAt) : DRAFT_HINT}
        </p>
      )}
    </form>
  );
}
