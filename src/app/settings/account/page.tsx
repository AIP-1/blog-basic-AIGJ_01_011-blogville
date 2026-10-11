import { DeleteAccountForm, NicknameForm } from "@/components/settings/SettingsForms";
import { getNickname, requireMember } from "@/server/dal";

export const metadata = { title: "내 정보 | Blogville" };

export default async function AccountPage() {
  const member = await requireMember();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-extrabold">내 정보</h1>
      <section className="rounded-2xl border border-line bg-surface p-5">
        <p className="mb-4 text-sm text-ink-soft">아이디: {member.username}</p>
        <NicknameForm nickname={await getNickname(member.userId)} />
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
