import { PixelLayers } from "../game/PixelLayers";

/**
 * 프로필 사진 동그라미 (BLOG-04). 사진이 있으면 `/files/{키}`(대체 글 `{닉네임} 프로필 사진`),
 * 없으면 캐릭터(GAME-01, 도트, 입은 아이템까지 SHOP-06), 캐릭터도 없으면 닉네임 첫 글자 원. 사진이 없을 때는 옆에 닉네임이 있어 읽지 않는다.
 */
export function ProfileAvatar({
  photoKey,
  nickname,
  character = [],
  size = 48,
}: {
  photoKey: string | null;
  nickname: string;
  /** 캐릭터 그림들 (아래 → 위) */
  character?: readonly string[];
  size?: number;
}) {
  const style = { width: size, height: size };
  if (photoKey) {
    // eslint-disable-next-line @next/next/no-img-element -- 권한을 확인하는 /files 주소라 이미지 최적화를 거치지 않는다
    return <img src={`/files/${photoKey}`} alt={`${nickname} 프로필 사진`} style={style} className="shrink-0 rounded-full border border-line object-cover" />;
  }
  if (character.length > 0) {
    return (
      <span aria-hidden="true" data-avatar-character style={style} className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-[#e8f5e9]">
        <PixelLayers arts={character} size={Math.round(size * 0.85)} />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      data-avatar-fallback
      style={{ ...style, fontSize: size * 0.42 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-[#e1f5fe] font-bold text-[#01579b]"
    >
      {Array.from(nickname)[0] ?? "?"}
    </span>
  );
}
