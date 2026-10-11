"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AUTH_ERRORS, PASSWORD_MAX } from "@/lib/auth-rules";
import { BLOG_ERRORS, checkNickname } from "@/lib/blog-rules";
import { deleteMember, verifyMemberPassword } from "@/server/account";
import { requireMember } from "@/server/dal";
import { updateNickname as saveNickname } from "@/server/profile";
import type { SettingsState } from "../blog/actions";

export async function updateNickname(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const member = await requireMember();
  const value = formData.get("nickname");
  const nickname = typeof value === "string" ? value : "";
  const error = checkNickname(nickname) ?? (await saveNickname(member.userId, nickname));
  if (error) return { error, values: { nickname } };
  revalidatePath("/", "layout");
  return { message: BLOG_ERRORS.saved, values: { nickname: nickname.trim() } };
}

export type WithdrawState = { error: string } | null;

/** 회원 탈퇴 (AUTH-06). 비밀번호를 다시 확인하고 바로 지운다. 실패하면 아무것도 지우지 않는다. */
export async function deleteAccount(_prev: WithdrawState, formData: FormData): Promise<WithdrawState> {
  const member = await requireMember();
  const value = formData.get("password");
  const password = typeof value === "string" ? value : "";
  if (!password) return { error: AUTH_ERRORS.withdrawEmpty };
  if (password.length > PASSWORD_MAX || !(await verifyMemberPassword(member.userId, password))) {
    return { error: AUTH_ERRORS.withdrawWrong };
  }
  // 세션 쿠키를 먼저 지운다 (회원을 지우면 세션 행도 함께 사라진다)
  await auth.api.signOut({ headers: await headers() });
  await deleteMember(member.userId, member.username);
  revalidatePath("/", "layout");
  redirect("/");
}
