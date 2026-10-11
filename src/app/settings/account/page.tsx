import { NicknameForm } from "@/components/settings/SettingsForms";
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
    </div>
  );
}
