import "server-only";

/**
 * 내 집이 보이는 마을 수 (plaza-upgrade-2, 글을 쓰고 마을로 돌아왔을 때의 축하 문구).
 * TODO(prompt): 나를 즐겨찾기해 마을에 집을 둔 회원 수를 센다. 지금은 0
 */
export async function countVillagesShowingMe(userId: string): Promise<number> {
  void userId;
  return 0;
}
