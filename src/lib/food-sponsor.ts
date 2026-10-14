// 🍽 블로그 후기 카드: 글 페이지에서 대표 사진(og:image)을 고르고, 협찬·내돈내산 표시를 찾는다.
// 서버만 쓰는 규칙이지만 순수 함수라 시험할 수 있게 lib에 둔다.

export type Sponsor = "sponsored" | "self" | null;

// 글쓴이가 직접 밝히는 협찬 문구 (공정위 표시 지침에 따라 글 앞·끝에 적는 말)
const SPONSOR_WORDS = [
  /협찬/,
  /원고료/,
  /(제품|서비스|식사|음식|메뉴|이용권|식사권|금액|비용)[^.\n]{0,12}(제공|지원)\s?받/,
  /(업체|가게|매장|식당)(로|으로)부터[^.\n]{0,20}(제공|지원|받)/,
  /무상으로\s?제공/,
  /체험단/,
  /유료\s?광고/,
  /광고\s?(포함|입니다|글)/,
  /(대가|비용)를?\s?(받|지원받)/,
  /sponsored/i,
];
// 체험단 사이트 배너 그림 주소 (글 끝에 붙는 "OO에서 제공받아…" 배너)
const SPONSOR_HOSTS = /(revu\.net|dinnerqueen\.net|reviewnote\.co\.kr|mrblog\.net|seoulouba\.co\.kr|ringble\.co\.kr|cometoplay\.kr|popomon\.com|tble\.kr|chvu\.co\.kr|4blog\.net|reviewplace\.co\.kr|xn--939au0g4vj8sq\.net|gangnammatzip|storyn\.kr|modan\.kr)/i;
const SELF_WORDS = /(내돈내산|내 돈 내 산|내돈 내산|직접 (계산|결제)했|광고 아님|광고 아닙니다|협찬 아님|협찬 아닙니다|협찬 없)/;

/** 글 본문(HTML 그대로)에서 협찬·내돈내산 표시. 협찬 문구가 있으면 협찬이 이긴다 ("협찬 아님"은 빼고) */
export function detectSponsor(html: string): Sponsor {
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const self = SELF_WORDS.test(text);
  const cleaned = text.replace(/협찬\s?(아님|아닙니다|없)|광고\s?(아님|아닙니다)/g, " ");
  if (SPONSOR_HOSTS.test(html) || SPONSOR_WORDS.some((re) => re.test(cleaned))) return "sponsored";
  return self ? "self" : null;
}

/** 대표 사진: og:image (https만) */
export function pickOgImage(html: string): string | null {
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (!m) return null;
  const url = m[1].replace(/&amp;/g, "&").replace(/^http:/, "https:");
  return /^https:\/\/[^\s"'<>]+$/.test(url) ? url : null;
}

/**
 * 서버가 읽어도 되는 글 주소. 네이버 블로그는 본문이 iframe 안이라 모바일 주소로 바꾼다.
 * 그 밖에는 티스토리·브런치만 (아무 주소나 서버가 열지 않게)
 */
export function reviewFetchUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  if (host === "blog.naver.com" || host === "m.blog.naver.com") {
    const m = u.pathname.match(/^\/([A-Za-z0-9_-]+)\/(\d+)/);
    if (m) return `https://m.blog.naver.com/${m[1]}/${m[2]}`;
    const id = u.searchParams.get("blogId");
    const no = u.searchParams.get("logNo");
    return id && no && /^[A-Za-z0-9_-]+$/.test(id) && /^\d+$/.test(no) ? `https://m.blog.naver.com/${id}/${no}` : null;
  }
  if (/(^|\.)tistory\.com$/.test(host) || host === "brunch.co.kr") return `https://${host}${u.pathname}`;
  return null;
}
