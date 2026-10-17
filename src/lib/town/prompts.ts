// 이번 주 글감 (plaza-upgrade-2): 게시판 쪽지·서랍 보조 줄·/prompt 화면이 같은 글감을 쓴다.

export type WeeklyPrompt = { key: string; title: string; hint: string; tag: string };

// TODO(prompt): 주마다 바뀌는 글감 목록. 지금은 자리만 잡아 둔 고정 글감 하나
const PLACEHOLDER: WeeklyPrompt = {
  key: "placeholder",
  title: "이번 주 글감",
  hint: "요즘 가장 자주 떠오르는 생각을 적어 보세요.",
  tag: "이번주글감",
};

/** `now`가 속한 주의 글감 */
export function currentPrompt(now: Date): WeeklyPrompt {
  void now;
  return PLACEHOLDER;
}
