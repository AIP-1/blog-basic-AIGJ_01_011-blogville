// YouTube 영상 넣기 (개선 9): 여러 모양의 주소에서 영상 ID(11자)를 꺼낸다. 저장할 때도 같은 규칙으로 다시 본다.

export const YOUTUBE_ERROR = "YouTube 영상 주소를 넣어 주세요 (예: https://youtu.be/…)";

const ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const m = /^\/(embed|shorts|live|v)\/([^/]+)/.exec(url.pathname);
      id = m ? m[2] : null;
    }
  }
  return id && ID.test(id) ? id : null;
}

/** 글에 넣는 영상 주소 (쿠키 없는 YouTube) */
export function youtubeEmbedSrc(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}
