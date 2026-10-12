import { PixelLayers } from "./PixelLayers";

/**
 * 미니룸 (BLOG-04·SHOP-04): 건 배경 위에 입은 모습의 캐릭터가 통통 튄다. 아래에 닉네임 배지.
 * 배경이 없으면 하늘색 칸만.
 */
export function Miniroom({ background, avatar, nickname, height = 160 }: { background: string | null; avatar: readonly string[]; nickname?: string; height?: number }) {
  const size = Math.round(height * 0.55);
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-line bg-[#bfe6ff]"
      style={{ height }}
      role="img"
      aria-label={nickname ? `${nickname}의 미니룸` : "미니룸"}
      data-miniroom
      data-background={background ?? ""}
    >
      {background && <PixelLayers arts={[background]} stretch className="absolute inset-0" />}
      <div className="absolute inset-x-0 bottom-3 flex flex-col items-center">
        <div className="motion-safe:animate-[hop_1.6s_ease-in-out_infinite]">
          <PixelLayers arts={avatar} size={size} />
        </div>
        {nickname && <span className="mt-1 rounded-full bg-white/85 px-2 text-xs font-bold text-ink">{nickname}</span>}
      </div>
    </div>
  );
}
