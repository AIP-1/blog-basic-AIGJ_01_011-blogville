import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { normalizeName } from "./names";

export const SESSION_REMEMBER_SECONDS = 60 * 60 * 24 * 7;

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
  plugins: [
    username({ minUsernameLength: 4, maxUsernameLength: 20, usernameNormalization: normalizeName }),
    nextCookies(),
  ],
});
