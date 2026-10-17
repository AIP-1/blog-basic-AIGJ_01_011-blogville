import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PhoneTown } from "@/components/town/PhoneTown";
import { TownGame } from "@/components/town/TownGame";
import { TownHud } from "@/components/town/TownHud";
import { lotFront } from "@/lib/town/layout";
import { boardPapers } from "@/lib/town/plaza";
import { parseSky } from "@/lib/town/sky";
import { townSpots } from "@/lib/town/structures";
import { getActiveNotice } from "@/server/admin-tools";
import { ensureTodayAttendanceOnce } from "@/server/attendance";
import { requireMember } from "@/server/dal";
import { getPlazaNews, getVillageNews } from "@/server/plaza";
import { getHudMember, getMemberHouses, getTownHost } from "@/server/town";

export async function generateMetadata({ params }: PageProps<"/town/[slug]">): Promise<Metadata> {
  const host = await getTownHost(decodeURIComponent((await params).slug));
  return { title: host ? `${host.nickname}님의 마을 | Blogville` : "마을 | Blogville" };
}

/**
 * 친구 마을 구경 (TOWN-15, specs/047-friend-town): 0번은 그 회원의 집, 1~10번은 그 회원이 즐겨찾는 이웃의 집.
 * 나는 내 캐릭터로 그 집 앞에서 시작하고, HUD(☰ 메뉴·지갑·글쓰기·오늘 할 일)는 내 것, 광장 소식 서랍은 그 마을 이웃의 새 글이다.
 * 내 주소면 내 마을로, 없는 주소·공지 블로그는 404. 휴대폰은 그 회원의 블로그로 (`PhoneTown`).
 */
export default async function FriendTownPage({ params, searchParams }: PageProps<"/town/[slug]">) {
  const member = await requireMember();
  const host = await getTownHost(decodeURIComponent((await params).slug));
  if (!host) notFound();
  if (host.userId === member.userId) redirect("/town");
  const { sky: skyParam } = await searchParams;
  // 출석은 레이아웃이 이미 했다 (한 요청에 한 번이라 다시 읽지 않는다): 게시판 도장 수
  const attendance = await ensureTodayAttendanceOnce(member.userId, member.sessionId).catch(() => null);
  const [houses, hud, village, notice] = await Promise.all([getMemberHouses(host.userId, member.userId), getHudMember(member.userId), getVillageNews(), getActiveNotice()]);
  const news = await getPlazaNews(member.userId, houses, village);
  const who = { nickname: host.nickname, slug: host.slug };
  const start = lotFront(0);
  const sky = parseSky(skyParam);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">{host.nickname}님의 마을</h1>
      <div className="relative min-h-0 flex-1 max-sm:hidden" data-town>
        <TownGame
          mailFlag={hud.unread > 0}
          houses={houses}
          member
          layers={hud.layers}
          name={hud.nickname}
          start={start}
          startKey={`host:${host.slug}`}
          place={`${host.nickname}님의 마을`}
          sky={sky}
          board={{ papers: boardPapers(houses), stamps: attendance?.cycleDay ?? 3 }}
        />
        <TownHud
          hud={hud}
          admin={member.role === "admin"}
          userId={member.userId}
          spots={townSpots(houses, true)}
          houses={houses}
          host={who}
          news={news}
          notice={notice ? { text: notice.text, link: notice.link || null } : null}
          sky={sky}
          start={start}
        />
      </div>
      <div className="sm:hidden">
        <PhoneTown mySlug={hud.blog.slug} host={who} />
      </div>
    </div>
  );
}
