import type { Metadata } from "next";
import { PhoneTown } from "@/components/town/PhoneTown";
import { TownGame } from "@/components/town/TownGame";
import { TownHud } from "@/components/town/TownHud";
import { TownWelcome } from "@/components/town/TownWelcome";
import { lotFront, START_POS } from "@/lib/town/layout";
import { townSpots } from "@/lib/town/structures";
import { ensureTodayAttendance } from "@/server/attendance";
import { getSession } from "@/server/dal";
import { unreadBadge } from "@/lib/notifications";
import { getGuestHouses, getHudMember, getMemberHouses } from "@/server/town";

export const metadata: Metadata = { title: "마을 | Blogville" };

/**
 * 마을 (TOWN-01~04·12, specs/038-town·039-town-menu): 회원은 내 집과 즐겨찾는 이웃의 집, 방문자는 인기 블로그 무작위 10채.
 * `?welcome=1`(가입 직후 🚪 밖으로)이면 내 집 앞에서 첫 마을 환영을, `?at={블로그 주소}`면 그 집 앞에서, 아니면 분수 아래에서 시작한다.
 * 헤더 막대 대신 ☰ 메뉴(`TownHud`). 휴대폰에는 게임 대신 `PhoneTown`, 회원이 아래 탭 ☰ 메뉴로 오면(`?menu=1`) 펼친 메뉴 화면.
 */
export default async function TownPage({ searchParams }: PageProps<"/town">) {
  const { at, welcome, menu } = await searchParams;
  const member = await getSession();
  // 헤더가 없는 마을에서도 그날 첫 화면이면 자동 출석이 ☰ 내 프로필 코인에 들어가게 먼저 한다 (GAME-04)
  if (member) await ensureTodayAttendance(member.userId, member.sessionId).catch((error) => console.error("자동 출석 실패", error));
  const [houses, hud] = member ? await Promise.all([getMemberHouses(member.userId), getHudMember(member.userId)]) : [await getGuestHouses(), null];
  const greet = hud !== null && welcome === "1";
  const home = greet ? houses.find((h) => h.mine) : typeof at === "string" ? houses.find((h) => h.slug === at) : undefined;
  const start = home ? lotFront(home.lot) : START_POS;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">중앙 광장</h1>
      <div className="relative min-h-0 flex-1 max-sm:hidden" data-town>
        <TownGame mailFlag={(hud?.unread ?? 0) > 0} houses={houses} member={member !== null} layers={hud?.layers ?? ["char.visitor"]} name={hud?.nickname ?? "구경하는 중"} start={start} startKey={typeof at === "string" ? at : ""} />
        <TownHud hud={hud} admin={member?.role === "admin"} userId={member?.userId ?? null} unread={unreadBadge(hud?.unread ?? 0)} spots={townSpots(houses, member !== null)} houses={houses} />
        {/* 환영을 주소에서 지운 뒤 화면을 다시 그려도(⭐·레벨업) 닫을 때까지 남는다 */}
        {hud && <TownWelcome nickname={hud.nickname} show={greet} />}
      </div>
      <div className="sm:hidden">
        {hud && menu === "1" ? (
          <TownHud phone hud={hud} admin={member?.role === "admin"} userId={member?.userId ?? null} unread={unreadBadge(hud.unread)} spots={townSpots(houses, true)} />
        ) : (
          <PhoneTown mySlug={hud?.blog.slug ?? null} />
        )}
      </div>
    </div>
  );
}
