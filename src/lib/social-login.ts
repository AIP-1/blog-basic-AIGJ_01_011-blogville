// 소셜 로그인과 연동 (AUTH-01, AUTH-05). 소셜로 가입하지 않고, 아이디로 가입한 회원이 내 정보에서 연동해 둔 계정으로만 로그인한다.

export const SOCIAL_PROVIDERS = [
  { id: "kakao", label: "카카오", env: "KAKAO" },
  { id: "naver", label: "네이버", env: "NAVER" },
  { id: "google", label: "Google", env: "GOOGLE" },
] as const;

export type SocialProviderId = (typeof SOCIAL_PROVIDERS)[number]["id"];
export type SocialProvider = { id: SocialProviderId; label: string };

type Env = Record<string, string | undefined>;

/** 서비스의 키. `{서비스}_CLIENT_ID`와 `_CLIENT_SECRET`이 둘 다 있어야 켠다 */
export function providerKeys(id: SocialProviderId, env: Env): { clientId: string; clientSecret: string } | null {
  const p = SOCIAL_PROVIDERS.find((s) => s.id === id)!;
  const clientId = env[`${p.env}_CLIENT_ID`]?.trim();
  const clientSecret = env[`${p.env}_CLIENT_SECRET`]?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** 키가 있는 서비스만 (버튼도 이것만 보인다) */
export function enabledProviders(env: Env): SocialProvider[] {
  return SOCIAL_PROVIDERS.filter((p) => providerKeys(p.id, env)).map(({ id, label }) => ({ id, label }));
}

export function isSocialProvider(value: unknown): value is SocialProviderId {
  return SOCIAL_PROVIDERS.some((p) => p.id === value);
}

export function providerLabel(id: SocialProviderId): string {
  return SOCIAL_PROVIDERS.find((p) => p.id === id)!.label;
}

/**
 * 라이브러리가 요구하는 이메일 자리. 카카오는 이메일을 받지 않고, 진짜 이메일을 쓰면 같은 이메일의 회원과 섞일 수 있어
 * 서비스와 서비스 쪽 ID로 만든 주소를 쓴다. 아이디 회원의 `{아이디}@users.blogville.invalid`와 겹치지 않는다.
 */
export function socialEmail(id: SocialProviderId, accountId: string | number): string {
  return `${id}_${accountId}@${id}.blogville.invalid`;
}

export const SOCIAL_MESSAGES = {
  notReady: "아직 연결 준비 중이에요",
  notLinked: "연동된 계정이 없어요. 아이디로 로그인한 뒤 내 정보에서 연동해 주세요",
  linkedToOther: "이미 다른 회원에게 연동된 계정이에요",
  linkFailed: "연동하지 못했어요. 다시 시도해 주세요",
  alreadyLinked: "이미 연동했어요",
  firstTime: "처음이라면 회원가입 후 내 정보에서 연동해 주세요",
  linked: (id: SocialProviderId) => `${providerLabel(id)} 계정을 연동했어요`,
  unlinked: (id: SocialProviderId) => `${providerLabel(id)} 연동을 해제했어요`,
} as const;

/** 소셜 로그인이 실패해 첫 화면으로 돌아왔을 때 보일 문구. 취소 등은 문구 없이 둔다 */
export function signInErrorMessage(code: unknown): string | null {
  if (code === "signup_disabled" || code === "account_not_linked" || code === "email_not_found") return SOCIAL_MESSAGES.notLinked;
  if (code === "not_ready") return SOCIAL_MESSAGES.notReady;
  return null;
}

/** 연동하다 실패해 내 정보로 돌아왔을 때 보일 문구 */
export function linkErrorMessage(code: unknown): string | null {
  if (typeof code !== "string" || !code) return null;
  if (code === "account_already_linked_to_different_user") return SOCIAL_MESSAGES.linkedToOther;
  if (code === "access_denied") return null;
  return SOCIAL_MESSAGES.linkFailed;
}
