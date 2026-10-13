import type { Metadata } from "next";
import { BannedWordsForm, NoticeForm } from "@/components/admin/SiteSettingsForms";
import { getNoticeSetting } from "@/server/admin-tools";
import { readBannedWords } from "@/server/banned-words";
import { requireAdmin } from "@/server/dal";

export const metadata: Metadata = { title: "사이트 설정 | 관리자 | Blogville" };

// 사이트 설정 (ADM-04·05, specs/058-admin-tools): 사이트 공지 띠와 금지어
export default async function AdminSettingsPage() {
  await requireAdmin();
  const [notice, words] = await Promise.all([getNoticeSetting(), readBannedWords()]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">⚙️ 사이트 설정</h1>
      <section aria-labelledby="site-notice" className="rounded-2xl border border-line bg-surface p-4">
        <h2 id="site-notice" className="mb-1 font-bold">
          📢 공지 띠
        </h2>
        <p className="mb-3 text-sm text-ink-soft">
          모든 화면 위에 한 줄로 보여요 (PC 마을 화면 제외). 회원이 닫으면 그 브라우저에서는 안 보이고, 다시 저장하면 또 보여요.
        </p>
        <NoticeForm notice={notice} />
      </section>
      <section aria-labelledby="banned" className="rounded-2xl border border-line bg-surface p-4">
        <h2 id="banned" className="mb-1 font-bold">
          🚫 금지어
        </h2>
        <p className="mb-3 text-sm text-ink-soft">글(제목·본문)·댓글·답글·방명록·문의를 저장할 때 들어 있으면 막아요. 관리자도 같아요.</p>
        <BannedWordsForm words={words} />
      </section>
    </div>
  );
}
