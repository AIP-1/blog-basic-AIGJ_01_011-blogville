import type { ReactNode } from "react";
import { PixelArtSvg } from "@/components/game/PixelArtSvg";
import { PAGE_MARKS, type PageMark } from "@/lib/art/site";

/**
 * 모아 보는 화면(마을 소식·이웃 새 글·인기 글·태그·알림함·업데이트 소식·버그·문의·스크랩)의 머리 (광장 개편):
 * 왼쪽에 마을의 작은 도트 그림, 오른쪽에 제목(Pretendard)과 한 줄 설명, 끝에 버튼.
 * 그림이 아이콘 노릇을 하므로 제목 앞 이모지는 화면에서만 숨긴다. 읽는 이름과 글자(textContent)는 `📋 마을 소식` 그대로다
 * (공백도 숨긴 칸 안에 둔다).
 */
export function PageHeader({
  id,
  emoji,
  title,
  mark,
  description,
  actions,
  titleClassName = "",
}: {
  id?: string;
  /** 제목 앞 이모지 (화면 낭독기와 글자 시험이 읽는다) */
  emoji: string;
  title: ReactNode;
  mark: PageMark;
  description?: ReactNode;
  /** 제목 줄 끝 (모두 읽음 같은 버튼) */
  actions?: ReactNode;
  titleClassName?: string;
}) {
  return (
    <div className="page-head">
      <span className="page-head-mark" aria-hidden="true">
        <PixelArtSvg art={PAGE_MARKS[mark]()} cell={2} />
      </span>
      <div className="min-w-0 flex-1">
        <h1 id={id} className={`text-2xl font-extrabold ${titleClassName}`}>
          <span className="sr-only">{emoji} </span>
          {title}
        </h1>
        {description && <div className="mt-0.5 text-sm text-ink-soft">{description}</div>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
