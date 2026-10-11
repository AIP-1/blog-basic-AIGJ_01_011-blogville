"use client";

import { useActionState } from "react";
import { updateNickname } from "@/app/settings/account/actions";
import { updateBlogInfo, updateBlogSlug, type SettingsState } from "@/app/settings/blog/actions";

function Status({ state }: { state: SettingsState }) {
  if (state?.error)
    return (
      <p role="alert" className="form-error">
        {state.error}
      </p>
    );
  if (state?.message)
    return (
      <p role="status" className="font-semibold text-accent">
        {state.message}
      </p>
    );
  return null;
}

export function BlogInfoForm({ title, intro }: { title: string; intro: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateBlogInfo, null);
  // 오류면 보낸 값을 그대로 다시 보여준다
  const values = state?.values ?? { title, intro };
  return (
    <form action={action} className="space-y-3" key={JSON.stringify(state)}>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">블로그 이름</span>
        <input name="title" className="field" maxLength={40} defaultValue={values.title} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">소개</span>
        <textarea name="intro" className="field min-h-24" maxLength={160} defaultValue={values.intro} />
      </label>
      <div className="flex items-center justify-end gap-3">
        <Status state={state} />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          저장
        </button>
      </div>
    </form>
  );
}

export function SlugForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateBlogSlug, null);
  return (
    <form action={action} className="space-y-3" key={JSON.stringify(state)}>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">블로그 주소</span>
        <span className="flex items-center gap-1">
          <span className="whitespace-nowrap text-ink-soft">/@</span>
          <input name="slug" className="field" maxLength={20} defaultValue={state?.values?.slug ?? slug} />
        </span>
        <span className="mt-1 block text-sm text-ink-soft">주소를 바꾸면 예전 주소로는 들어올 수 없어요.</span>
      </label>
      <div className="flex items-center justify-end gap-3">
        <Status state={state} />
        <button type="submit" className="btn" disabled={pending}>
          주소 바꾸기
        </button>
      </div>
    </form>
  );
}

export function NicknameForm({ nickname }: { nickname: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateNickname, null);
  return (
    <form action={action} className="space-y-3" key={JSON.stringify(state)}>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">닉네임</span>
        <input name="nickname" className="field" maxLength={20} defaultValue={state?.values?.nickname ?? nickname} />
      </label>
      <div className="flex items-center justify-end gap-3">
        <Status state={state} />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          저장
        </button>
      </div>
    </form>
  );
}
