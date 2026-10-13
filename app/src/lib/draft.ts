// 임시 저장 (POST-08): 새 글 화면의 쓰던 내용을 이 브라우저(localStorage)에 회원마다 1개 둔다.
// 서버로 보내지 않는다. 저장소를 쓸 수 없으면 모두 조용히 건너뛴다.

export type Draft = {
  title: string;
  categoryId: number | null;
  subcategoryId: number | null;
  visibility: "public" | "private";
  contentHtml: string;
  tags: string;
  savedAt: number;
};

export const DRAFT_DELAY_MS = 2000;
export const DRAFT_HINT = "작성 중인 글은 이 브라우저에 자동 저장됩니다.";
export const DRAFT_ASK = "작성 중이던 글이 있어요. 불러올까요?";

export const draftKey = (userId: string) => `blogville:draft:${userId}`;

const positiveInt = (v: unknown) => (typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : null);
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** 저장된 값을 읽는다. 형식이 틀린 칸은 버리고, JSON이 아니거나 비어 있으면 null. */
export function parseDraft(raw: string | null): Draft | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const draft: Draft = {
    title: str(v.title),
    categoryId: positiveInt(v.categoryId),
    subcategoryId: positiveInt(v.subcategoryId),
    visibility: v.visibility === "private" ? "private" : "public",
    contentHtml: str(v.contentHtml),
    tags: str(v.tags),
    savedAt: typeof v.savedAt === "number" && Number.isFinite(v.savedAt) ? v.savedAt : 0,
  };
  return draft.title.trim() === "" && draft.contentHtml === "" ? null : draft;
}

/** 제목(앞뒤 공백 제외)과 본문 글자가 모두 비었으면 저장하지 않는다 */
export function isEmptyDraft(title: string, contentText: string): boolean {
  return title.trim() === "" && contentText.length === 0;
}

export function readDraft(userId: string): Draft | null {
  try {
    return parseDraft(window.localStorage.getItem(draftKey(userId)));
  } catch {
    return null;
  }
}

/** 저장하면 true */
export function writeDraft(userId: string, draft: Draft): boolean {
  try {
    window.localStorage.setItem(draftKey(userId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(userId: string): void {
  try {
    window.localStorage.removeItem(draftKey(userId));
  } catch {
    // 저장소를 쓸 수 없으면 지울 것도 없다
  }
}

const timeFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** `임시 저장됨 14:05` (한국 시간, 24시간제) */
export function savedLabel(savedAt: number): string {
  return `임시 저장됨 ${timeFormat.format(new Date(savedAt))}`;
}
