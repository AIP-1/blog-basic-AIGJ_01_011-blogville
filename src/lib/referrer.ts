// 글 유입 경로 (통계 상세): 이전 주소(document.referrer)를 출처 이름 하나로 줄인다.
// 주소 전체(검색어·글 주소)는 남기지 않는다.

const KNOWN: [RegExp, string][] = [
  [/(^|\.)naver\.(com|me)$/, "naver"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)(daum\.net|kakao\.com)$/, "daum"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)(x\.com|twitter\.com|t\.co)$/, "x"],
  [/(^|\.)(facebook\.com|fb\.com)$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)tistory\.com$/, "tistory"],
  [/(^|\.)(github\.com|github\.io)$/, "github"],
];

export const SOURCE_LABEL: Record<string, string> = {
  direct: "🔗 직접 들어옴 (주소 입력·즐겨찾기·앱)",
  blogville: "🏘 Blogville 안 (마을 소식·이웃·검색)",
  naver: "🟢 네이버",
  google: "🔵 구글",
  daum: "🟡 다음·카카오",
  bing: "🔷 빙",
  x: "✖️ X(트위터)",
  facebook: "📘 페이스북",
  instagram: "📸 인스타그램",
  tistory: "🟠 티스토리",
  github: "🐙 GitHub",
};

/** 출처 이름: direct / blogville / 알려진 사이트 이름 / 그 밖의 호스트(www. 뺌, 60자까지) */
export function referrerSource(referrer: string, siteHost: string): string {
  if (!referrer) return "direct";
  let host: string;
  try {
    const url = new URL(referrer);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "direct";
    host = url.hostname.toLowerCase();
  } catch {
    return "direct";
  }
  if (host === siteHost.toLowerCase()) return "blogville";
  for (const [pattern, name] of KNOWN) if (pattern.test(host)) return name;
  return host.replace(/^www\./, "").slice(0, 60) || "direct";
}

/** 화면에 보일 이름 */
export function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? `🌐 ${source}`;
}
