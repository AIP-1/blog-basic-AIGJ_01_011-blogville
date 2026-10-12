/**
 * 프로필 사진 동그라미 (BLOG-04). 사진이 있으면 `/files/{키}`(대체 글 `{닉네임} 프로필 사진`),
 * 없으면 닉네임 첫 글자를 넣은 기본 원 (캐릭터가 아직 없어 그 자리를 대신한다). 기본 원은 옆에 닉네임이 있어 읽지 않는다.
 */
export function ProfileAvatar({ photoKey, nickname, size = 48 }: { photoKey: string | null; nickname: string; size?: number }) {
  const style = { width: size, height: size };
  if (photoKey) {
    // eslint-disable-next-line @next/next/no-img-element -- 권한을 확인하는 /files 주소라 이미지 최적화를 거치지 않는다
    return <img src={`/files/${photoKey}`} alt={`${nickname} 프로필 사진`} style={style} className="shrink-0 rounded-full border border-line object-cover" />;
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
