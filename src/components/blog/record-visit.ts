// 방문·조회 기록 요청 (/api/visits). 실패하면 null: 숫자는 처음 그린 값 그대로 둔다
export async function postVisit<T>(body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}
