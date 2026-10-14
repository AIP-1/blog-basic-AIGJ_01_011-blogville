import "server-only";
import { RELEASES_REPO, sanitizeReleaseHtml, type Release } from "@/lib/releases";

/**
 * GitHub 릴리스 목록 (최신순 100개까지). 새 릴리스가 나오면 10분 안에 사이트에 보인다.
 * 로그인 없이 부르는 GitHub API는 서버 IP당 한 시간에 60번이라 10분마다 한 번만 새로 받는다.
 * 받지 못하면 null (화면은 GitHub 링크로 안내).
 */
export async function listReleases(): Promise<Release[] | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${RELEASES_REPO}/releases?per_page=100`, {
      headers: { accept: "application/vnd.github.html+json", "x-github-api-version": "2022-11-28", "user-agent": "blogville" },
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { tag_name: string; name: string | null; published_at: string | null; html_url: string; body_html?: string; draft: boolean; prerelease: boolean }[];
    return rows
      .filter((r) => !r.draft && !r.prerelease && r.published_at)
      .map((r) => ({
        tag: r.tag_name,
        name: r.name || r.tag_name,
        publishedAt: new Date(r.published_at!),
        url: r.html_url,
        html: sanitizeReleaseHtml(r.body_html ?? ""),
      }));
  } catch {
    return null;
  }
}

/** 버전 하나 (/updates/v1.6.0). 목록과 같은 응답(캐시)을 쓰고, 앞뒤 버전도 함께 돌려준다 */
export async function getRelease(tag: string): Promise<{ release: Release; newer: Release | null; older: Release | null } | null | "error"> {
  const all = await listReleases();
  if (all === null) return "error";
  const i = all.findIndex((r) => r.tag === tag);
  if (i < 0) return null;
  return { release: all[i], newer: all[i - 1] ?? null, older: all[i + 1] ?? null };
}
