import "server-only";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { and, eq, gt, sql } from "drizzle-orm";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { normalizeName } from "./names";
import { providerKeys, socialEmail } from "./social-login";

export const SESSION_REMEMBER_SECONDS = 60 * 60 * 24 * 7;
/** 소셜 로그인 버튼을 누를 때 [로그인 상태 유지]를 담아 두는 쿠키 (돌아와서 세션을 만들 때 읽는다) */
export const SOCIAL_REMEMBER_COOKIE = "bv_social_remember";
/** 정지된 회원이 로그인하면 세션을 만들지 않고 이 코드로 거절한다 (관리자 회원 정지) */
export const SUSPENDED_CODE = "ACCOUNT_SUSPENDED";

async function isSuspendedNow(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.id, userId), gt(schema.users.suspendedUntil, sql`now()`)));
  return Boolean(row);
}

// 소셜 로그인 (AUTH-01): 키가 있는 서비스만 켠다. 소셜로 새 회원을 만들지 않는다(disableSignUp).
// 이메일은 서비스 ID로 만든 자리값을 쓴다 (socialEmail). 카카오는 이메일 동의를 요청하지 않는다.
const env = process.env;
const kakao = providerKeys("kakao", env);
const naver = providerKeys("naver", env);
const google = providerKeys("google", env);
const socialProviders = {
  ...(kakao && {
    kakao: {
      ...kakao,
      disableSignUp: true,
      disableDefaultScope: true,
      scope: ["profile_nickname", "profile_image"],
      mapProfileToUser: (profile: { id: number }) => ({ email: socialEmail("kakao", profile.id), emailVerified: false }),
    },
  }),
  ...(naver && {
    naver: {
      ...naver,
      disableSignUp: true,
      mapProfileToUser: (profile: { response: { id: string } }) => ({ email: socialEmail("naver", profile.response.id), emailVerified: false }),
    },
  }),
  ...(google && {
    google: {
      ...google,
      disableSignUp: true,
      mapProfileToUser: (profile: { sub: string }) => ({ email: socialEmail("google", profile.sub), emailVerified: false }),
    },
  }),
};

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema: {
      users: schema.users,
      sessions: schema.sessions,
      accounts: schema.accounts,
      verifications: schema.verifications,
    },
  }),
  // 가입은 우리 트랜잭션(createMember)이 맡는다. 라이브러리 가입 경로는 쓰지 않는다.
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8, maxPasswordLength: 64 },
  session: {
    // [로그인 상태 유지] 세션은 7일, 쓰는 동안 1시간마다 다시 7일. 유지 안 함 세션의 2시간 규칙은 dal.ts
    expiresIn: SESSION_REMEMBER_SECONDS,
    updateAge: 60 * 60,
    additionalFields: {
      rememberMe: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "user", input: false },
    },
  },
  socialProviders,
  account: {
    // 연동(AUTH-05)은 로그인한 회원이 직접 누를 때만. 이메일이 같다고 저절로 묶지 않는다
    accountLinking: {
      enabled: true,
      allowDifferentEmails: true,
      disableImplicitLinking: true,
      trustedProviders: ["kakao", "naver", "google"],
      updateUserInfoOnLink: false,
    },
  },
  databaseHooks: {
    session: {
      create: {
        // 소셜 로그인으로 만든 세션: 버튼을 누를 때 [로그인 상태 유지]를 골랐으면 7일 유지, 아니면 아이디 로그인처럼 2시간 (AUTH-09)
        before: async (session, ctx) => {
          // 정지된 회원은 아이디·소셜 어느 쪽으로도 세션을 만들 수 없다
          if (await isSuspendedNow(session.userId)) throw new APIError("FORBIDDEN", { message: SUSPENDED_CODE, code: SUSPENDED_CODE });
          if (!ctx?.path?.startsWith("/callback/")) return;
          if (ctx.getCookie(SOCIAL_REMEMBER_COOKIE) === "1") return { data: { ...session, rememberMe: true } };
          return { data: { ...session, rememberMe: false, expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) } };
        },
      },
    },
  },
  // 라이브러리 오류는 영어 오류 화면 대신 첫 화면으로
  onAPIError: { errorURL: "/" },
  plugins: [
    username({ minUsernameLength: 4, maxUsernameLength: 20, usernameNormalization: normalizeName }),
    nextCookies(),
  ],
});
