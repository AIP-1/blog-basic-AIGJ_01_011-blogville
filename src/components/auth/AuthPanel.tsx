"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, startSocialSignIn, type AuthFormState } from "@/app/(auth)/actions";
import { defaultBlogTitle } from "@/lib/blog-rules";
import { SOCIAL_MESSAGES, type SocialProvider } from "@/lib/social-login";
import type { StarterCharacter } from "@/server/items";
import { PixelCharacter } from "../game/PixelCharacter";

/**
 * `next`: 로그인하면 돌아갈 이 사이트 안의 주소 (서버가 safeNext로 거른 값, 로그인 액션이 다시 거른다)
 * `providers`: 키가 있는 소셜 로그인 서비스 (AUTH-01). 비어 있으면 간편 로그인 칸을 숨긴다
 * `socialError`: 소셜 로그인이 실패해 돌아왔을 때의 문구
 */
export function AuthPanel({
  next,
  characters,
  providers,
  socialError,
}: {
  next: string | null;
  characters: StarterCharacter[];
  providers: SocialProvider[];
  socialError: string | null;
}) {
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
      {tab === "signin" ? <SignInForm next={next} /> : <SignUpForm characters={characters} />}
      {socialError && (
        <p role="alert" className="form-error mt-3">
          {socialError}
        </p>
      )}
      {providers.length > 0 && <SocialButtons providers={providers} form={tab === "signin" ? SIGNIN_FORM : undefined} />}
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

const SIGNIN_FORM = "signin-form";


/**
 * 간편 로그인 버튼 (AUTH-01). 로그인 탭에서는 로그인 폼(`form`)으로 보내 [로그인 상태 유지]를 함께 넘기고,
 * 회원가입 탭에서는 자기 폼으로 보낸다. 연동해 둔 계정만 로그인된다.
 */
function SocialButtons({ providers, form }: { providers: SocialProvider[]; form?: string }) {
  const buttons = providers.map((p) => (
    <button
      key={p.id}
      type="submit"
      form={form}
      formAction={startSocialSignIn.bind(null, p.id)}
      formNoValidate
      className={`btn btn-${p.id} flex-1 font-semibold`}
      data-social={p.id}
    >
      {p.label}
    </button>
  ));
  return (
    <section aria-labelledby="social-login" className="mt-4 border-t border-line pt-4" data-social-login>
      <h2 id="social-login" className="mb-2 text-center text-sm font-semibold text-ink-soft">
        간편 로그인
      </h2>
      {form ? (
        <div className="flex flex-wrap gap-2">{buttons}</div>
      ) : (
        <form className="flex flex-wrap gap-2">
          {buttons}
        </form>
      )}
      <p className="mt-2 text-center text-xs text-ink-soft">{SOCIAL_MESSAGES.firstTime}</p>
    </section>
  );
}

function SignInForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signIn, null);
  return (
    <form id={SIGNIN_FORM} action={action} className="space-y-3" noValidate>
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

function SignUpForm({ characters }: { characters: StarterCharacter[] }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUp, null);
  // 처음에는 첫 번째(남자 주민). 다른 칸 오류로 돌아와도 고른 캐릭터는 그대로 (GAME-01)
  const [characterId, setCharacterId] = useState(state?.values.characterId ?? String(characters[0]?.id ?? ""));
  const [username, setUsername] = useState(state?.values.username ?? "");
  // 회원이 블로그 이름을 고치기 전에는 아이디를 따라간다. 칸을 비우면 다시 따라간다.
  const [customTitle, setCustomTitle] = useState("");
  const blogTitle = customTitle || (username.trim() ? defaultBlogTitle(username.trim().toLowerCase()) : "");

  return (
    <form
      action={(formData) => {
        formData.set("blogTitle", blogTitle);
        formData.set("characterId", characterId);
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
      {/* 고르기는 버튼(role=radio)으로 한다. 폼 액션이 끝나면 React가 폼을 되돌려 진짜 라디오는 처음 값으로 돌아가기 때문 */}
      <div role="radiogroup" aria-labelledby="signup-character" className="space-y-1">
        <p id="signup-character" className="text-sm font-semibold">
          캐릭터 고르기
        </p>
        <div
          className="grid grid-cols-2 gap-2"
          // 라디오처럼 ←→↑↓로 옮겨 고르고, Tab은 고른 카드에만 멈춘다
          onKeyDown={(e) => {
            const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
            if (!step || characters.length === 0) return;
            e.preventDefault();
            const at = characters.findIndex((c) => String(c.id) === characterId);
            const next = (at + step + characters.length) % characters.length;
            setCharacterId(String(characters[next].id));
            (e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]")[next])?.focus();
          }}
        >
          {characters.map((c) => {
            const on = characterId === String(c.id);
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => setCharacterId(String(c.id))}
                className={`flex min-h-11 flex-col items-center gap-1 rounded-xl border-2 p-2 text-sm font-semibold ${on ? "border-amber-400 bg-amber-50" : "border-line"}`}
                data-character-card={on ? "on" : "off"}
              >
                <PixelCharacter art={c.art} size={56} />
                {c.name}
              </button>
            );
          })}
        </div>
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
