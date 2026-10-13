import Link from "next/link";
import { DeleteAccountForm, NicknameForm, PasswordForm } from "@/components/settings/SettingsForms";
import { ProfilePhotoForm } from "@/components/settings/ProfilePhotoForm";
import { SocialAccounts } from "@/components/settings/SocialAccounts";
import { enabledProviders, isSocialProvider, linkErrorMessage, SOCIAL_MESSAGES } from "@/lib/social-login";
import { listLinkedAccounts } from "@/server/social-login";
import { getNickname, requireMember } from "@/server/dal";
import { getProfilePhotoKey } from "@/server/profile";

export const metadata = { title: "내 정보 | Blogville" };

/** 연동하고 돌아온 결과 (AUTH-05) */
function socialNotice(query: Record<string, string | string[] | undefined>) {
  if (isSocialProvider(query.linked)) return { message: SOCIAL_MESSAGES.linked(query.linked), error: null };
  if (isSocialProvider(query.unlinked)) return { message: SOCIAL_MESSAGES.unlinked(query.unlinked), error: null };
  if (query.error === "already_linked") return { message: null, error: SOCIAL_MESSAGES.alreadyLinked };
  if (query.error === "not_ready") return { message: null, error: SOCIAL_MESSAGES.notReady };
  return { message: null, error: linkErrorMessage(query.error) };
}

export default async function AccountPage({ searchParams }: PageProps<"/settings/account">) {
  const member = await requireMember();
  const [nickname, photoKey, linked, query] = await Promise.all([
    getNickname(member.userId),
    getProfilePhotoKey(member.userId),
    listLinkedAccounts(member.userId),
    searchParams,
  ]);
  const notice = socialNotice(query);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">내 정보</h1>
        {/* 🔖 내 스크랩 (specs/059-report-bookmarks): 헤더 [👤 내 정보]에서 들어온다 */}
        <Link href="/bookmarks" className="btn">
          🔖 내 스크랩
        </Link>
      </div>
      <section className="rounded-2xl border border-line bg-surface p-5">
        <p className="mb-4 text-sm text-ink-soft">아이디: {member.username}</p>
        <NicknameForm nickname={nickname} />
      </section>
      <section aria-labelledby="photo" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="photo" className="mb-3 text-lg font-bold">
          프로필 사진
        </h2>
        <ProfilePhotoForm photoKey={photoKey} nickname={nickname} />
      </section>
      <section aria-labelledby="login-methods" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="login-methods" className="mb-3 text-lg font-bold">
          로그인 수단
        </h2>
        <SocialAccounts
          username={member.username}
          providers={enabledProviders(process.env)}
          linked={linked}
          message={notice.message}
          error={notice.error}
        />
      </section>
      <section aria-labelledby="password" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="password" className="mb-3 text-lg font-bold">
          비밀번호 바꾸기
        </h2>
        <PasswordForm />
      </section>
      <section aria-labelledby="withdraw" className="rounded-2xl border border-danger/40 bg-surface p-5">
        <h2 id="withdraw" className="mb-3 text-lg font-bold text-danger">
          회원 탈퇴
        </h2>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
