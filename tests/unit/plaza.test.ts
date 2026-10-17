import { describe, expect, it } from "vitest";
import {
  BOARD_PAPERS_MAX,
  boardPapers,
  clockText,
  countToday,
  isFreshPost,
  neighborNews,
  PLAZA_NEWS_SIZE,
  plazaNews,
  seededShuffle,
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

const IDLE: TodayState = { attended: false, postRewards: 0, postedToday: false, fished: false, farmCares: 0 };

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
  it("출석·글쓰기·낚시·동물 돌보기, 장소가 있는 일은 텔레포트 자리", () => {
    const tasks = todayTasks(IDLE);
    expect(tasks.map((t) => t.id)).toEqual(["attendance", "post", "fishing", "farm"]);
    expect(tasks.map((t) => t.spot ?? null)).toEqual(["board", null, "pond", "farm"]);
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

  it("돌보기는 15번을 채워야 끝, 출석·낚시는 했어요/아직이에요", () => {
    const [attendance, , fishing, farm] = todayTasks({ ...IDLE, attended: true, farmCares: 4 });
    expect(farm.done).toBe(false);
    expect(taskProgressText(farm)).toBe("돌보기 보상 4/15");
    expect(todayTasks({ ...IDLE, farmCares: 15 })[3].done).toBe(true);
    expect(taskProgressText(attendance)).toBe("오늘 했어요");
    expect(taskProgressText(fishing)).toBe("아직이에요");
  });
});

describe("방문자 마을 섞기 (광장 개편)", () => {
  const pool = Array.from({ length: 30 }, (_, i) => i);

  it("같은 씨앗이면 같은 순서, 다른 날이면 다른 순서", () => {
    const a = seededShuffle(pool, "2026-10-17");
    expect(seededShuffle(pool, "2026-10-17")).toEqual(a);
    expect(seededShuffle(pool, "2026-10-18")).not.toEqual(a);
    expect([...a].sort((x, y) => x - y)).toEqual(pool);
  });

  it("원래 배열은 그대로 둔다", () => {
    const input = [1, 2, 3, 4, 5];
    seededShuffle(input, "seed");
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect(seededShuffle([], "seed")).toEqual([]);
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
