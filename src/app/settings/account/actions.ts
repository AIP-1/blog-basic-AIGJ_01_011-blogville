"use server";

import { revalidatePath } from "next/cache";
import { BLOG_ERRORS, checkNickname } from "@/lib/blog-rules";
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
