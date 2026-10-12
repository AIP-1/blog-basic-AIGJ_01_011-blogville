"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthFormState } from "@/app/(auth)/actions";
import { defaultBlogTitle } from "@/lib/blog-rules";

/** `next`: 로그인하면 돌아갈 이 사이트 안의 주소 (서버가 safeNext로 거른 값, 로그인 액션이 다시 거른다) */
export function AuthPanel({ next }: { next: string | null }) {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div role="tablist" aria-label="로그인 또는 회원가입" className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-bg p-1">
        {(
          [
            ["signin", "로그인"],
            ["signup", "회원가입"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            className={`btn ${tab === key ? "shadow-sm" : "btn-ghost text-ink-soft"}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "signin" ? <SignInForm next={next} /> : <SignUpForm />}
    </div>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold">
      {children}
    </label>
  );
}

function SignInForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signIn, null);
  return (
    <form action={action} className="space-y-3" noValidate>
      {next && (
        <>
          <input type="hidden" name="next" value={next} />
          <p className="text-sm text-ink-soft">로그인하면 보던 화면으로 돌아가요</p>
        </>
      )}
      <div>
        <Label htmlFor="signin-username">아이디</Label>
        <input id="signin-username" name="username" className="field" autoComplete="username" defaultValue={state?.values.username} key={state?.values.username} />
      </div>
      <div>
        <Label htmlFor="signin-password">비밀번호</Label>
        <input id="signin-password" name="password" type="password" className="field" autoComplete="current-password" maxLength={64} />
      </div>
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" name="rememberMe" className="size-5" defaultChecked={state?.values.rememberMe === "on"} />
        로그인 상태 유지
      </label>
      {state?.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "들어가는 중..." : "로그인"}
      </button>
    </form>
  );
}

function SignUpForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUp, null);
  const [username, setUsername] = useState(state?.values.username ?? "");
  // 회원이 블로그 이름을 고치기 전에는 아이디를 따라간다. 칸을 비우면 다시 따라간다.
  const [customTitle, setCustomTitle] = useState("");
  const blogTitle = customTitle || (username.trim() ? defaultBlogTitle(username.trim().toLowerCase()) : "");

  return (
    <form
      action={(formData) => {
        formData.set("blogTitle", blogTitle);
        return action(formData);
      }}
      className="space-y-3"
      noValidate
    >
      <div>
        <Label htmlFor="signup-username">아이디</Label>
        <input
          id="signup-username"
          name="username"
          className="field"
          autoComplete="username"
          maxLength={20}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          aria-describedby="signup-username-help"
        />
        <p id="signup-username-help" className="mt-1 text-sm text-ink-soft">
          영문 소문자, 숫자, _ 로 4~20자
        </p>
      </div>
      <div>
        <Label htmlFor="signup-password">비밀번호</Label>
        <input id="signup-password" name="password" type="password" className="field" placeholder="비밀번호 (8자 이상)" autoComplete="new-password" maxLength={64} />
      </div>
      <div>
        <Label htmlFor="signup-confirm">비밀번호 확인</Label>
        <input id="signup-confirm" name="passwordConfirm" type="password" className="field" autoComplete="new-password" maxLength={64} />
      </div>
      <div>
        <Label htmlFor="signup-blog-title">블로그 이름</Label>
        <input
          id="signup-blog-title"
          className="field"
          placeholder="블로그 이름 (예: 나의 작은 정원)"
          maxLength={40}
          value={blogTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          aria-describedby="signup-blog-title-help"
        />
        <p id="signup-blog-title-help" className="mt-1 text-sm text-ink-soft">
          40자까지, 나중에 블로그 관리에서 바꿀 수 있어요
        </p>
      </div>
      {state?.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "가입하는 중..." : "회원가입"}
      </button>
    </form>
  );
}
