import type { Metadata } from "next";
import { PHONE_PLAZA } from "@/components/town/phone-plaza";
import { PhonePlaza } from "@/components/town/PhonePlaza";
import { PhoneTown } from "@/components/town/PhoneTown";
import { TownGame } from "@/components/town/TownGame";
import { TownHud } from "@/components/town/TownHud";
import { TownWelcome } from "@/components/town/TownWelcome";
import { lotFront, START_POS } from "@/lib/town/layout";
import { boardPapers } from "@/lib/town/plaza";
import { parseSky, skyAt } from "@/lib/town/sky";
import { townSpots } from "@/lib/town/structures";
import { parseReturnSpot } from "@/lib/town/zones";
import { getActiveNotice } from "@/server/admin-tools";
import { ensureTodayAttendanceOnce } from "@/server/attendance";
import { getSession } from "@/server/dal";
import { getPlazaNews, getVillageNews } from "@/server/plaza";
import { getGuestHouses, getHudMember, getMemberHouses } from "@/server/town";

export const metadata: Metadata = { title: "마을 | Blogville" };

/** 출석 도장 수를 모를 때(방문자·출석 실패) 게시판 그림: 예전 그림과 같은 3개 */
const DEFAULT_STAMPS = 3;

/**
 * 마을 (TOWN-01~04·12, specs/038-town·039-town-menu, 광장 개편): 회원은 내 집과 즐겨찾는 이웃의 집, 방문자는 인기 블로그 10채(하루 동안 같은 마을).
 * 시작 자리: `?welcome=1`(가입 직후 🚪 밖으로)이면 내 집 앞에서 첫 마을 환영, `?at={블로그 주소}`면 그 집 앞,
 * `?from={장소}`(게임 화면의 [광장으로])면 그 건물 문 앞, 아니면 분수 아래. `?sky=night`처럼 하늘을 고정할 수 있다(시험·미리보기).
 * 헤더 막대 대신 HUD(`TownHud`: ☰ 메뉴·지갑·글쓰기·장소 간판·광장 소식 서랍).
 * 휴대폰은 게임 대신: 회원은 세로 광장(`PhonePlaza`, `PHONE_PLAZA`), 방문자는 간단 메뉴(`PhoneTown`), 아래 탭 ☰로 오면(`?menu=1`) 펼친 메뉴 화면.
 */
export default async function TownPage({ searchParams }: PageProps<"/town">) {
  const { at, welcome, menu, sky: skyParam, from } = await searchParams;
  const member = await getSession();
  // 헤더가 없는 마을에서도 그날 첫 화면이면 자동 출석이 ☰ 내 프로필 코인에 들어가게 먼저 한다 (GAME-04). 레이아웃과 한 요청에 한 번
  const attendance = member
    ? await ensureTodayAttendanceOnce(member.userId, member.sessionId).catch((error) => {
        console.error("자동 출석 실패", error);
        return null;
      })
    : null;
  // 마을 전체 새 글(서랍에 이웃 글이 없을 때)은 가벼운 8편 쿼리라 기다리지 않게 집과 같이 읽어 둔다. 공지는 레이아웃이 이미 읽었다(한 요청 한 번)
  const [houses, hud, village, notice] = member
    ? await Promise.all([getMemberHouses(member.userId), getHudMember(member.userId), getVillageNews(), getActiveNotice()])
    : await Promise.all([getGuestHouses(), null, getVillageNews(), getActiveNotice()]);
  const news = await getPlazaNews(member?.userId ?? null, houses, village);
  const spots = townSpots(houses, member !== null);
  const greet = hud !== null && welcome === "1";
  const home = greet ? houses.find((h) => h.mine) : typeof at === "string" ? houses.find((h) => h.slug === at) : undefined;
  const back = parseReturnSpot(from);
  const door = home ? undefined : spots.places.find((p) => p.id === back);
  const start = home ? lotFront(home.lot) : door ? { x: door.x, y: door.y } : START_POS;
  const startKey = typeof at === "string" ? at : door ? `from:${door.id}` : "";
  const sky = parseSky(skyParam);
  const board = { papers: boardPapers(houses), stamps: attendance?.cycleDay ?? DEFAULT_STAMPS };
  const banner = notice ? { text: notice.text, link: notice.link || null } : null;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">중앙 광장</h1>
      <div className="relative min-h-0 flex-1 max-sm:hidden" data-town>
        <TownGame
          mailFlag={(hud?.unread ?? 0) > 0}
          chooseLots={member !== null}
          houses={houses}
          member={member !== null}
          layers={hud?.layers ?? ["char.visitor"]}
          name={hud?.nickname ?? "구경하는 중"}
          start={start}
          startKey={startKey}
          sky={sky}
          board={board}
        />
        <TownHud hud={hud} admin={member?.role === "admin"} userId={member?.userId ?? null} spots={spots} houses={houses} news={news} notice={banner} sky={sky} start={start} />
        {/* 환영을 주소에서 지운 뒤 화면을 다시 그려도(⭐·레벨업) 닫을 때까지 남는다 */}
        {hud && <TownWelcome nickname={hud.nickname} show={greet} />}
      </div>
      <div className="sm:hidden">
        {hud && menu === "1" ? (
          <TownHud phone hud={hud} admin={member?.role === "admin"} userId={member?.userId ?? null} spots={townSpots(houses, true)} />
        ) : hud && PHONE_PLAZA ? (
          <PhonePlaza hud={hud} houses={houses} news={news} sky={sky ?? skyAt()} />
        ) : (
          <PhoneTown mySlug={hud?.blog.slug ?? null} />
        )}
      </div>
    </div>
  );
}
