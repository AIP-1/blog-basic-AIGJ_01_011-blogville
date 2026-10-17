import Link from "next/link";
import { REWARD_RULES } from "@/lib/game";

/**
 * 창문 칸: 오늘 받은 글 보상만큼 노란 불이 켜진 작은 창 (광장의 글 쓴 집 창문과 같은 불빛).
 * 집 그림이라 밝은·어두운 화면 모두 같은 나무틀·불빛 색이다. 글자 정보가 아니라 화면 낭독기에는 숨긴다(이름에 있음).
 */
export function WindowCells({ lit, total }: { lit: number; total: number }) {
  return (
    <span className="inline-flex shrink-0 gap-[3px] bg-[#3b2a20] p-[3px]" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`block size-2 ${i < lit ? "bg-[#ffd36b]" : "shadow-[inset_0_0_0_2px_#9c8468]"}`} data-lit={i < lit ? "" : undefined} />
      ))}
    </span>
  );
}

/**
 * ✏️ 글쓰기 (광장 개편): 광장 왼쪽 위와 휴대폰 광장에 늘 보이는 주 버튼. 오늘 글 보상(공개·새 글·100자 이상, 하루 3번)을
 * 창문 3칸으로 보여 준다. 칸은 '보상' 수라 짧은 글을 썼으면 글은 썼어도 칸은 비어 있다. 방문자는 가입하러 첫 화면으로.
 * 시험 훅 `data-town-write`, `data-write-progress="n/3"`.
 */
export function WriteButton({ rewards, className = "" }: { rewards: number | null; className?: string }) {
  if (rewards === null) {
    return (
      <Link href="/" className={`px-btn px-btn--primary ${className}`} data-town-write="guest">
        ✏️ 가입하고 글쓰기
      </Link>
    );
  }
  const total = REWARD_RULES.post.dailyLimit;
  const lit = Math.min(rewards, total);
  return (
    <Link
      href="/write"
      className={`px-btn px-btn--primary ${className}`}
      aria-label={`글쓰기, 오늘 글 보상 ${lit}/${total}`}
      title={`오늘 글 보상 ${lit}/${total}`}
      data-town-write
      data-write-progress={`${lit}/${total}`}
    >
      <span>✏️ 글쓰기</span>
      <WindowCells lit={lit} total={total} />
    </Link>
  );
}
