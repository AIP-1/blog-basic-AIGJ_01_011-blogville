import { describe, expect, it } from "vitest";
import {
  BOARD_PAPERS_MAX,
  boardPapers,
  clockText,
  countToday,
  dailyLots,
  dailyPick,
  isFreshPost,
  neighborNews,
  PLAZA_NEWS_SIZE,
  plazaNews,
  taskProgressText,
  todayTasks,
  type PlazaPost,
  type TodayState,
} from "@/lib/town/plaza";

/** 한국 시각 2026-10-17 h:m (UTC+9) */
const kst = (h: number, m = 0, day = 17) => new Date(Date.UTC(2026, 9, day, h - 9, m));
const NOW = kst(20, 0);
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

type House = Parameters<typeof neighborNews>[0][number];
const house = (lot: number, slug: string, posts: [number, number][], mine = false): House => ({
  lot,
  mine,
  slug,
  nickname: `${slug}님`,
  recentPosts: posts.map(([id, h]) => ({ id, title: `${slug} 글 ${id}`, createdAt: hoursAgo(h) })),
});

const IDLE: TodayState = { attended: false, postRewards: 0, postedToday: false, fished: false, farmCares: 0, canCare: true };

describe("광장 소식: 이웃 새 글 (광장 개편)", () => {
  it("내 집·0번 자리는 빼고 7일 안의 글만 최신순으로", () => {
    const houses = [
      house(0, "me", [[1, 1]], true),
      house(0, "host", [[2, 1]]),
      house(1, "a", [
        [10, 5],
        [11, 30],
        [12, 24 * 8],
      ]),
      house(2, "b", [[20, 2]]),
    ];
    const posts = neighborNews(houses, NOW);
    expect(posts.map((p) => p.id)).toEqual([20, 10, 11]);
    expect(posts[0]).toMatchObject({ slug: "b", nickname: "b님", title: "b 글 20" });
  });

  it("7일은 마을 소식의 즐겨찾기 기간과 같은 한국 날짜 7일 (오늘 포함, 6일 전 0시부터)", () => {
    // 2026-10-17 01:00 KST: 10월 11일 0시부터
    const now = kst(1, 0, 17);
    const at = (h: number, day: number, id: number) => ({ id, title: `글 ${id}`, createdAt: kst(h, 0, day).toISOString() });
    const houses: House[] = [{ lot: 1, mine: false, slug: "a", nickname: "a님", recentPosts: [at(0, 11, 2), at(12, 10, 1)] }];
    expect(neighborNews(houses, now).map((p) => p.id)).toEqual([2]);
  });

  it("같은 시각이면 글 번호가 큰 것 먼저, 8편까지", () => {
    const houses = Array.from({ length: 5 }, (_, i) =>
      house(i + 1, `n${i}`, [
        [i * 10 + 1, 3],
        [i * 10 + 2, 3],
      ]),
    );
    const posts = neighborNews(houses, NOW);
    expect(posts).toHaveLength(PLAZA_NEWS_SIZE);
    expect(posts[0].id).toBe(42);
    expect(posts.map((p) => p.id)).toEqual([...posts.map((p) => p.id)].sort((a, b) => b - a));
  });

  it("이웃 글이 없으면 마을 전체 글로, 방문자는 늘 마을 전체", () => {
    const village: PlazaPost[] = [
      { id: 7, title: "마을 글", slug: "v", nickname: "v님", createdAt: hoursAgo(2) },
      { id: 6, title: "어제 글", slug: "v", nickname: "v님", createdAt: hoursAgo(30) },
    ];
    const empty = plazaNews("me", [house(0, "me", [[1, 1]], true)], village, NOW);
    expect(empty.scope).toBe("village");
    expect(empty.posts.map((p) => [p.id, p.fresh])).toEqual([
      [7, true],
      [6, false],
    ]);
    expect(empty.todayCount).toBe(1);

    const withNeighbor = plazaNews("me", [house(1, "a", [[10, 1]])], village, NOW);
    expect(withNeighbor.scope).toBe("neighbors");
    expect(withNeighbor.posts.map((p) => p.id)).toEqual([10]);

    expect(plazaNews(null, [house(1, "a", [[10, 1]])], village, NOW).scope).toBe("village");
  });

  it("24시간 안의 글만 불 켜진 창", () => {
    expect(isFreshPost(hoursAgo(23.9), NOW)).toBe(true);
    expect(isFreshPost(hoursAgo(24), NOW)).toBe(false);
  });

  it("오늘은 한국 날짜로 센다", () => {
    // 한국 0시 직전·직후
    const posts = [{ createdAt: kst(23, 59, 16).toISOString() }, { createdAt: kst(0, 1).toISOString() }];
    expect(countToday(posts, NOW)).toBe(1);
  });

  it("게시판 쪽지는 마을 집들의 오늘 글 수, 5장까지", () => {
    const houses = [house(0, "me", [[1, 1]], true), house(1, "a", [[2, 2]])];
    expect(boardPapers(houses, NOW)).toBe(2);
    const many = Array.from({ length: 4 }, (_, i) =>
      house(i, `m${i}`, [
        [i * 10 + 1, 1],
        [i * 10 + 2, 2],
      ]),
    );
    expect(boardPapers(many, NOW)).toBe(BOARD_PAPERS_MAX);
    expect(boardPapers([], NOW)).toBe(0);
  });
});

describe("오늘 할 일 (광장 개편)", () => {
  it("출석·글쓰기·낚시·동물 돌보기, 장소가 있는 일은 텔레포트 자리 (출석은 게시판 앞이 마을 소식 입구와 겹쳐 링크)", () => {
    const tasks = todayTasks(IDLE);
    expect(tasks.map((t) => t.id)).toEqual(["attendance", "post", "fishing", "farm"]);
    expect(tasks.map((t) => t.spot ?? null)).toEqual([null, null, "pond", "farm"]);
    expect(tasks.every((t) => !t.done)).toBe(true);
    expect(tasks.map((t) => t.progress.total)).toEqual([1, 3, 1, 15]);
  });

  it("글쓰기는 보상 n/3을 세고, 보상 없이 써도 한 것으로", () => {
    const rewarded = todayTasks({ ...IDLE, postRewards: 2 }).find((t) => t.id === "post")!;
    expect(rewarded.done).toBe(true);
    expect(taskProgressText(rewarded)).toBe("글 보상 2/3");
    const short = todayTasks({ ...IDLE, postedToday: true }).find((t) => t.id === "post")!;
    expect(short.done).toBe(true);
    expect(taskProgressText(short)).toBe("글 보상 0/3");
    // 상한을 넘지 않는다
    expect(todayTasks({ ...IDLE, postRewards: 9 })[1].progress.current).toBe(3);
  });

  it("돌보기는 15번을 채우거나 오늘 돌볼 동물을 다 돌보면 끝, 출석·낚시는 했어요/아직이에요", () => {
    const [attendance, , fishing, farm] = todayTasks({ ...IDLE, attended: true, farmCares: 4 });
    expect(farm.done).toBe(false);
    expect(taskProgressText(farm)).toBe("돌보기 보상 4/15");
    expect(todayTasks({ ...IDLE, farmCares: 15 })[3].done).toBe(true);
    // 키우는 동물이 2마리면 6번이 끝: 더 돌볼 동물이 없으면 한 것 (보상 수는 그대로 6/15)
    const twoAnimals = todayTasks({ ...IDLE, farmCares: 6, canCare: false })[3];
    expect(twoAnimals.done).toBe(true);
    expect(taskProgressText(twoAnimals)).toBe("돌보기 보상 6/15");
    // 동물이 없어 한 번도 못 돌봤으면 아직
    expect(todayTasks({ ...IDLE, canCare: false })[3].done).toBe(false);
    expect(taskProgressText(attendance)).toBe("오늘 했어요");
    expect(taskProgressText(fishing)).toBe("아직이에요");
  });
});

describe("방문자 마을 고르기 (광장 개편)", () => {
  const pool = Array.from({ length: 100 }, (_, i) => ({ blogId: i + 1 }));
  const ids = (rows: { blogId: number }[]) => rows.map((r) => r.blogId);

  it("같은 날이면 같은 10곳, 다른 날이면 다른 10곳", () => {
    const a = dailyPick(pool, "2026-10-17", (r) => r.blogId, 10);
    expect(a).toHaveLength(10);
    expect(dailyPick(pool, "2026-10-17", (r) => r.blogId, 10)).toEqual(a);
    expect(ids(dailyPick(pool, "2026-10-18", (r) => r.blogId, 10))).not.toEqual(ids(a));
    expect(new Set(ids(a)).size).toBe(10);
  });

  it("후보 순서(방문 수)가 바뀌어도 같고, 후보 하나가 빠지면 많아야 한 곳만 바뀐다", () => {
    const day = "2026-10-17";
    const a = ids(dailyPick(pool, day, (r) => r.blogId, 10));
    expect(ids(dailyPick([...pool].reverse(), day, (r) => r.blogId, 10))).toEqual(a);
    // 고른 집 하나가 100곳에서 빠지면 그 자리만 다음 순위로 바뀐다
    const b = ids(dailyPick(pool.filter((r) => r.blogId !== a[3]), day, (r) => r.blogId, 10));
    expect(a.filter((id) => !b.includes(id))).toEqual([a[3]]);
    expect(b.filter((id) => !a.includes(id))).toHaveLength(1);
    // 안 고른 후보가 빠지면 그대로
    const c = ids(dailyPick(pool.filter((r) => !a.includes(r.blogId)).slice(1).concat(pool.filter((r) => a.includes(r.blogId))), day, (r) => r.blogId, 10));
    expect(c).toEqual(a);
  });

  it("원래 배열은 그대로 두고, 후보가 적으면 있는 만큼", () => {
    const input = [{ blogId: 1 }, { blogId: 2 }, { blogId: 3 }];
    expect(dailyPick(input, "seed", (r) => r.blogId, 10)).toHaveLength(3);
    expect(input).toEqual([{ blogId: 1 }, { blogId: 2 }, { blogId: 3 }]);
    expect(dailyPick([], "seed", (r: { blogId: number }) => r.blogId, 10)).toEqual([]);
  });
});

describe("장소 간판 시계 (광장 개편)", () => {
  it("한국 시각을 하늘 이름과 12시간으로", () => {
    expect(clockText(kst(21, 41))).toBe("밤 9:41");
    expect(clockText(kst(14, 5))).toBe("낮 2:05");
    expect(clockText(kst(0, 0))).toBe("밤 12:00");
    expect(clockText(kst(12, 30))).toBe("낮 12:30");
    expect(clockText(kst(17, 30))).toBe("노을 5:30");
  });

  it("하늘을 고정하면 그 이름", () => {
    expect(clockText(kst(14, 5), "night")).toBe("밤 2:05");
  });
});

describe("방문자 마을 자리 (dailyLots)", () => {
  const pool = Array.from({ length: 100 }, (_, i) => ({ blogId: i + 1 }));
  const lotsOf = (items: { blogId: number }[], day: string) => new Map(dailyLots(items, day, (r) => r.blogId, 10).map((x) => [x.item.blogId, x.lot]));
  it("고른 집마다 1~10 서로 다른 자리, 같은 날 같은 자리", () => {
    const day = "2026-10-17";
    const picked = dailyPick(pool, day, (r) => r.blogId, 10);
    const lots = [...lotsOf(picked, day).values()];
    expect(new Set(lots).size).toBe(10);
    expect(lots.every((l) => l >= 1 && l <= 10)).toBe(true);
    expect(lotsOf(picked, day)).toEqual(lotsOf(picked, day));
    expect(dailyLots(pool.slice(0, 12), day, (r) => r.blogId, 10)).toHaveLength(10);
    expect(dailyLots([], day, (r: { blogId: number }) => r.blogId, 10)).toEqual([]);
  });
  it("고른 집 하나가 빠져도 나머지는 대개 제자리 (순위대로 자리를 주면 뒤 집이 모두 옮겨 간다)", () => {
    let moved = 0;
    let cases = 0;
    for (let d = 1; d <= 28; d++) {
      const day = `2026-10-${String(d).padStart(2, "0")}`;
      const picked = dailyPick(pool, day, (r) => r.blogId, 10);
      const before = lotsOf(picked, day);
      for (const gone of picked) {
        const after = lotsOf(dailyPick(pool.filter((r) => r.blogId !== gone.blogId), day, (r) => r.blogId, 10), day);
        for (const [id, lot] of before) if (after.has(id) && after.get(id) !== lot) moved++;
        cases++;
      }
    }
    expect(moved / cases).toBeLessThan(2.5);
  });
});
