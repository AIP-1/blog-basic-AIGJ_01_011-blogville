"use server";

import { eq, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { APIError } from "better-auth/api";
import { suspendedMessage } from "@/lib/admin-rules";
import { auth, SOCIAL_REMEMBER_COOKIE, SUSPENDED_CODE } from "@/lib/auth";
import { AUTH_ERRORS, checkSignUp, PASSWORD_MAX } from "@/lib/auth-rules";
import { parseId } from "@/lib/ids";
import { normalizeName } from "@/lib/names";
import { safeNext } from "@/lib/safe-next";
import { enabledProviders, isSocialProvider, SOCIAL_MESSAGES } from "@/lib/social-login";
import { getMyBlog, getSession } from "@/server/dal";
import { clearLoginAttempts, reserveLoginAttempt } from "@/server/login-attempts";
import { createMember, SignUpError } from "@/server/signup";

export type AuthFormState = { error: string; values: Record<string, string> } | null;

const field = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

/** 라이브러리로 로그인하고 세션의 유지 방식을 기록한다 (AUTH-09: 유지 안 함 2시간 / 유지 7일) */
async function startSession(username: string, password: string, rememberMe: boolean): Promise<"ok" | "failed" | "suspended"> {
  let token: string;
  try {
    const result = await auth.api.signInUsername({
      body: { username, password, rememberMe },
      headers: await headers(),
    });
    if (!result?.token) return "failed";
    token = result.token;
  } catch (e) {
    // 비밀번호가 맞아도 정지된 회원이면 세션을 만들 때 거절된다 (auth.ts)
    return e instanceof APIError && (e.body as { code?: string } | undefined)?.code === SUSPENDED_CODE ? "suspended" : "failed";
  }
  await db
    .update(sessions)
    .set(rememberMe ? { rememberMe: true } : { rememberMe: false, expiresAt: sql`now() + interval '2 hours'` })
    .where(eq(sessions.token, token));
  if (rememberMe) await clearDontRememberCookie();
  return "ok";
}

/**
 * 전에 [로그인 상태 유지] 없이 로그인했던 브라우저에 남은 `dont_remember` 쿠키를 지운다 (AUTH-09).
 * 남아 있으면 라이브러리가 유지 세션도 연장하지 않고, 갱신할 때 세션 쿠키를 브라우저를 닫으면 사라지는 쿠키로 바꾼다.
 */
async function clearDontRememberCookie() {
  const { name, attributes } = (await auth.$context).authCookies.dontRememberToken;
  const store = await cookies();
  // __Secure- 접두사 쿠키는 같은 secure·경로로 지워야 한다
  if (store.has(name)) store.set(name, "", { path: attributes.path ?? "/", secure: attributes.secure, httpOnly: true, maxAge: 0 });
}

async function goToMyBlog(userId: string, query = ""): Promise<never> {
  const blog = await getMyBlog(userId);
  redirect(`/@${blog.slug}${query}`);
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const current = await getSession();
  if (current) await goToMyBlog(current.userId);

  // role 같은 다른 칸은 읽지 않는다
  const input = {
    username: field(formData, "username"),
    password: field(formData, "password"),
    passwordConfirm: field(formData, "passwordConfirm"),
    blogTitle: field(formData, "blogTitle"),
  };
  const values = { username: input.username, blogTitle: input.blogTitle, characterId: field(formData, "characterId") };
  const error = checkSignUp(input);
  if (error) return { error, values };
  // 캐릭터 ID 모양만 여기서 보고, 기본 캐릭터인지는 가입 트랜잭션이 DB로 다시 본다 (GAME-01)
  const characterId = parseId(values.characterId);
  if (characterId === null) return { error: AUTH_ERRORS.character, values };

  const username = normalizeName(input.username);
  try {
    await createMember({ username, password: input.password, blogTitle: input.blogTitle, characterId });
  } catch (e) {
    if (e instanceof SignUpError) return { error: e.message, values };
    throw e;
  }
  await startSession(username, input.password, false);
  revalidatePath("/", "layout");
  redirect(`/@${username}?welcome=1`);
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const username = normalizeName(field(formData, "username"));
  const password = field(formData, "password");
  const rememberMe = formData.get("rememberMe") === "on";
  const values = { username: field(formData, "username"), rememberMe: rememberMe ? "on" : "" };

  if (!username || !password) return { error: AUTH_ERRORS.signInEmpty, values };
  if (password.length > PASSWORD_MAX || username.length > 64) return { error: AUTH_ERRORS.signInFailed, values };
  if (!(await reserveLoginAttempt(username))) return { error: AUTH_ERRORS.locked, values };

  const started = await startSession(username, password, rememberMe);
  if (started === "suspended") {
    await clearLoginAttempts(username);
    const [row] = await db.select({ until: users.suspendedUntil, reason: users.suspendReason }).from(users).where(eq(users.username, username));
    return { error: row?.until ? suspendedMessage(row.until, row.reason) : SOCIAL_MESSAGES.suspended, values };
  }
  if (started === "failed") return { error: AUTH_ERRORS.signInFailed, values };
  await clearLoginAttempts(username);

  revalidatePath("/", "layout");
  // 보던 화면에서 [로그인]을 눌러 왔으면 그리로 돌아간다. 이 사이트 밖 주소는 버린다 (조작한 값 포함)
  const next = safeNext(formData.get("next"));
  if (next) redirect(next);
  // 로그인하면 마을에서 시작한다 (TOWN-01·AUTH-09). 휴대폰은 마을이 내 블로그로 옮긴다
  redirect("/town");
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * 소셜 로그인 시작 (AUTH-01). 키가 없는 서비스면 첫 화면으로 돌려보낸다.
 * [로그인 상태 유지]는 서비스에 다녀오는 동안 쿠키(10분)에 담아 두고, 돌아와 세션을 만들 때 읽는다 (auth.ts).
 * 연동해 둔 계정이 아니면 라이브러리가 `/?error=signup_disabled` 등으로 돌려보낸다.
 */
export async function startSocialSignIn(provider: unknown, formData: FormData) {
  if (!isSocialProvider(provider) || !enabledProviders(process.env).some((p) => p.id === provider)) redirect("/?error=not_ready");
  const store = await cookies();
  if (formData.get("rememberMe") === "on") {
    store.set(SOCIAL_REMEMBER_COOKIE, "1", { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600 });
  } else if (store.has(SOCIAL_REMEMBER_COOKIE)) {
    store.delete(SOCIAL_REMEMBER_COOKIE);
  }
  const result = await auth.api.signInSocial({
    body: { provider, callbackURL: "/town", errorCallbackURL: "/" },
    headers: await headers(),
  });
  if (!result?.url) redirect("/?error=not_ready");
  redirect(result.url);
}
