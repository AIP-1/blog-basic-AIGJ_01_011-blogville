"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AUTH_ERRORS, checkPasswordChange, PASSWORD_MAX } from "@/lib/auth-rules";
import { BLOG_ERRORS, checkNickname } from "@/lib/blog-rules";
import { changeMemberPassword, deleteMember, verifyMemberPassword } from "@/server/account";
import { requireMember } from "@/server/dal";
import { KEY_PATTERN } from "@/lib/attachments";
import { PHOTO_ERRORS, removeProfilePhoto, setProfilePhoto, updateNickname as saveNickname } from "@/server/profile";
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

export type PasswordState = { error: string } | { message: string } | null;

/** 비밀번호 바꾸기. 지금 비밀번호를 확인하고, 다른 기기의 로그인은 끊는다. */
export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const member = await requireMember();
  const text = (name: string) => {
    const v = formData.get(name);
    return typeof v === "string" ? v : "";
  };
  const input = { current: text("current"), next: text("next"), confirm: text("confirm") };
  const error = checkPasswordChange(input);
  if (error) return { error };
  if (input.current.length > PASSWORD_MAX || !(await verifyMemberPassword(member.userId, input.current))) {
    return { error: AUTH_ERRORS.changeWrong };
  }
  await changeMemberPassword(member.userId, member.sessionId, input.next);
  return { message: AUTH_ERRORS.changed };
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

export type PhotoState = { error: string } | { message: string } | null;

/** 프로필 사진 바꾸기 (BLOG-03): 화면이 `/api/uploads`로 올린 사진의 키를 받는다 */
export async function saveProfilePhoto(formData: FormData): Promise<PhotoState> {
  const member = await requireMember();
  const key = formData.get("key");
  if (typeof key !== "string" || !KEY_PATTERN.test(key)) return { error: PHOTO_ERRORS.invalid };
  const error = await setProfilePhoto(member.userId, key);
  if (error) return { error };
  revalidatePath("/", "layout");
  return { message: PHOTO_ERRORS.saved };
}

/** 프로필 사진 지우기 */
export async function deleteProfilePhoto(): Promise<PhotoState> {
  const member = await requireMember();
  await removeProfilePhoto(member.userId);
  revalidatePath("/", "layout");
  return { message: PHOTO_ERRORS.removed };
}
