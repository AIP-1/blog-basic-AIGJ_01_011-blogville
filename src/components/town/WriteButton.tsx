"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { REWARD_RULES } from "@/lib/game";

/** 처음 몇 번 광장에 올 때는 설명을 저절로 잠깐 띄운다 (이 브라우저에 센다) */
const TIP_KEY = "bv-write-tip";
const TIP_AUTO_VISITS = 3;
const TIP_AUTO_MS = 4000;

/** 글쓰기 버튼 설명 (plaza-upgrade-2): 보상 n/3과 한 편의 보상, 다 받았으면 초롱 안내 */
export function writeTip(lit: number, total: number): string {
  const rule = REWARD_RULES.post;
  return lit >= total ? "오늘 보상 다 받았어요 · 그래도 쓰면 내 초롱이 켜져요" : `오늘 글 보상 ${lit}/${total} · 한 편에 ✨${rule.exp} 🪙${rule.coin}`;
}

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
 * 창문 칸이 무엇인지 알 수 있게 hover·focus 때(그리고 이 브라우저의 첫 3번 방문에 잠깐) 작은 설명을 띄운다 (plaza-upgrade-2, `writeTip`).
 * 시험 훅 `data-town-write`, `data-write-progress="n/3"`, 설명 `data-write-tip`.
 */
export function WriteButton({ rewards, className = "" }: { rewards: number | null; className?: string }) {
  if (rewards === null) {
    return (
      <Link href="/" className={`px-btn px-btn--primary ${className}`} data-town-write="guest">
        ✏️ 가입하고 글쓰기
      </Link>
    );
  }
  return <MemberWriteButton rewards={rewards} className={className} />;
}

function MemberWriteButton({ rewards, className }: { rewards: number; className: string }) {
  const total = REWARD_RULES.post.dailyLimit;
  const lit = Math.min(rewards, total);
  const tipId = useId();
  const [auto, setAuto] = useState(false);
  // 휴대폰 광장(폭 가득 버튼)과 손가락 화면에서는 저절로 띄우지 않는다: 아래 목록 머리를 가린다 (D5)
  const phoneWide = className.includes("w-full");
  useEffect(() => {
    if (phoneWide || window.matchMedia("(pointer: coarse)").matches) return;
    let seen = TIP_AUTO_VISITS;
    try {
      seen = Number(localStorage.getItem(TIP_KEY)) || 0;
      if (seen < TIP_AUTO_VISITS) localStorage.setItem(TIP_KEY, String(seen + 1));
    } catch {}
    if (seen >= TIP_AUTO_VISITS) return;
    // 저장소를 읽은 뒤 한 번만 켠다 (서버 그림과 처음 그림은 늘 꺼진 채라 같다)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저 저장소를 읽은 뒤에만 정할 수 있다
    setAuto(true);
    const timer = window.setTimeout(() => setAuto(false), TIP_AUTO_MS);
    // 창(☰·우체통)을 열면 저절로 띄운 설명은 접는다 (창 머리를 가리지 않게)
    const onPanel = () => setAuto(false);
    window.addEventListener("bv-panel", onPanel);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("bv-panel", onPanel);
    };
  }, [phoneWide]);
  return (
    // 설명 쪽지를 버튼 바로 아래에 두는 틀: 버튼의 폭(휴대폰 광장의 w-full)과 클릭 받기(광장 간판 묶음)를 따른다
    <span
      className={`group/write relative ${className.includes("w-full") ? "flex w-full" : "inline-flex"} ${className.includes("pointer-events-auto") ? "pointer-events-auto" : ""}`}
    >
      <Link
        href="/write"
        className={`px-btn px-btn--primary ${className}`}
        aria-label={`글쓰기, 오늘 글 보상 ${lit}/${total}`}
        aria-describedby={tipId}
        data-town-write
        data-write-progress={`${lit}/${total}`}
      >
        <span>✏️ 글쓰기</span>
        <WindowCells lit={lit} total={total} />
      </Link>
      <span
        id={tipId}
        role="tooltip"
        className={`px-box pointer-events-none absolute left-0 top-[calc(100%+10px)] z-30 w-max max-w-[16rem] px-2.5 py-1.5 text-xs font-semibold text-(--kit-ink) ${
          auto ? "block" : "hidden group-hover/write:block group-focus-within/write:block"
        }`}
        data-write-tip
      >
        {writeTip(lit, total)}
      </span>
    </span>
  );
}
