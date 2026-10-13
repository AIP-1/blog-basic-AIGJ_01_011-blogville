import { linkSocial, unlinkSocial } from "@/app/settings/account/actions";
import { SOCIAL_PROVIDERS, type SocialProvider } from "@/lib/social-login";
import type { LinkedAccount } from "@/server/social-login";

const dateKST = (d: Date) => d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });

/** 내 정보의 로그인 수단 (AUTH-05): 아이디 로그인 + 키가 있는 서비스마다 연동·해제 */
export function SocialAccounts({
  username,
  providers,
  linked,
  message,
  error,
}: {
  username: string;
  providers: SocialProvider[];
  linked: LinkedAccount[];
  message: string | null;
  error: string | null;
}) {
  // 키를 뺀 서비스라도 이미 연동한 계정은 보여 주고 해제할 수 있게 한다
  const shown = SOCIAL_PROVIDERS.filter((p) => providers.some((e) => e.id === p.id) || linked.some((l) => l.providerId === p.id));
  return (
    <div className="space-y-2" data-social-accounts>
      {message && (
        <p role="status" className="text-sm font-semibold text-accent">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <ul className="divide-y divide-line">
        <li className="flex min-h-11 items-center justify-between gap-2 py-2">
          <span>
            아이디 로그인 · <b>{username}</b>
          </span>
        </li>
        {shown.map((p) => {
          const account = linked.find((l) => l.providerId === p.id);
          const enabled = providers.some((e) => e.id === p.id);
          return (
            <li key={p.id} className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2" data-social-row={p.id}>
              <span>
                {p.label}
                {account && <span className="ml-2 text-sm text-ink-soft">연동됨 ({dateKST(account.linkedAt)})</span>}
              </span>
              {account ? (
                <form action={unlinkSocial}>
                  <input type="hidden" name="provider" value={p.id} />
                  <button type="submit" className="btn btn-ghost">
                    연동 해제
                  </button>
                </form>
              ) : enabled ? (
                <form action={linkSocial}>
                  <input type="hidden" name="provider" value={p.id} />
                  <button type="submit" className="btn">
                    {p.label} 연동하기
                  </button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && <p className="text-sm text-ink-soft">간편 로그인(카카오·네이버·Google)은 준비 중이에요</p>}
    </div>
  );
}
