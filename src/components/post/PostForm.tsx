"use client";

import { useActionState, useState, useTransition } from "react";
import { savePost, type PostFormState } from "@/app/write/actions";
import { checkPostInput, CONTENT_BYTES_MAX, POST_ERRORS, TITLE_MAX, utf8Bytes } from "@/lib/post-rules";
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
  };
};

export function PostForm({ categories, initial }: Props) {
  const [state, action] = useActionState<PostFormState, FormData>(savePost, null);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [contentHtml, setContentHtml] = useState(initial?.contentHtml ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ? String(initial.categoryId) : "");
  const [subcategoryId, setSubcategoryId] = useState(initial?.subcategoryId ? String(initial.subcategoryId) : "");
  const [visibility, setVisibility] = useState<"public" | "private">(initial?.isPublic === false ? "private" : "public");
  const [localError, setLocalError] = useState<string | null>(null);

  const subs = categories.find((c) => String(c.id) === categoryId)?.subs ?? [];
  const error = localError ?? state?.error;

  // 값은 모두 화면 상태에 두고 onSubmit에서 보낸다. 오류가 나도 입력이 남는다 (POST-01).
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const raw = { postId: initial ? String(initial.postId) : "", title, contentHtml, categoryId, subcategoryId, visibility };
    const checked = checkPostInput(raw);
    if (!checked.ok) return setLocalError(checked.error);
    if (utf8Bytes(contentHtml) > CONTENT_BYTES_MAX) return setLocalError(POST_ERRORS.tooLong);
    setLocalError(null);
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
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        <select
          aria-label="대분류"
          className="field field-auto"
          value={categoryId}
          onChange={(e) => {
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
          onChange={(e) => setSubcategoryId(e.target.value)}
        >
          <option value="">소분류 없음</option>
          {subs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <RichEditor initialHtml={initial?.contentHtml ?? ""} onChange={(html) => setContentHtml(html)} />

      <fieldset className="flex gap-2">
        <legend className="sr-only">공개 설정</legend>
        {(
          [
            ["public", "🌍 공개"],
            ["private", "🔒 비공개"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className={`btn cursor-pointer ${visibility === value ? "btn-selected" : ""}`}>
            <input type="radio" name="visibility" value={value} checked={visibility === value} onChange={() => setVisibility(value)} className="sr-only" />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="flex items-center justify-end gap-3">
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "저장하는 중..." : initial ? "수정 완료" : "발행하기"}
        </button>
      </div>
    </form>
  );
}
