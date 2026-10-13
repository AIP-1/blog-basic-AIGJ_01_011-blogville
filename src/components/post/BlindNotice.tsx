/** 관리자가 가린 글: 작성자에게만 보이는 안내 (관리자 글 블라인드) */
export function BlindNotice({ reason }: { reason: string | null }) {
  return (
    <p role="note" className="mb-4 rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm" data-blind-notice>
      🚫 관리자가 가린 글이에요{reason ? ` (사유: ${reason})` : ""}. 나만 볼 수 있고, 다시 공개할 수 없어요. 궁금한 점은 🐞 버그·문의로 알려 주세요.
    </p>
  );
}
