import type { Metadata } from "next";
import { PhoneTown } from "@/components/town/PhoneTown";
import { TownGame } from "@/components/town/TownGame";
import { lotFront, START_POS } from "@/lib/town/layout";
import { getMyBlog, getNickname, getSession } from "@/server/dal";
import { getAvatar } from "@/server/items";
import { getGuestHouses, getMemberHouses } from "@/server/town";

export const metadata: Metadata = { title: "마을 | Blogville" };

/**
 * 마을 (TOWN-01~04, specs/038-town): 회원은 내 집과 즐겨찾는 이웃의 집, 방문자는 인기 블로그 무작위 10채.
 * `?at={블로그 주소}`면 그 집 앞에서, 아니면 분수 아래에서 시작한다. 휴대폰에는 게임 대신 `PhoneTown`.
 */
export default async function TownPage({ searchParams }: PageProps<"/town">) {
  const { at } = await searchParams;
  const member = await getSession();
  const [houses, avatar, nickname, blog] = member
    ? await Promise.all([getMemberHouses(member.userId), getAvatar(member.userId), getNickname(member.userId), getMyBlog(member.userId)])
    : [await getGuestHouses(), null, null, null];
  const home = typeof at === "string" ? houses.find((h) => h.slug === at) : undefined;
  const start = home ? lotFront(home.lot) : START_POS;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">중앙 광장</h1>
      <div className="min-h-0 flex-1 max-sm:hidden" data-town>
        <TownGame houses={houses} member={member !== null} layers={avatar?.layers ?? ["char.visitor"]} name={nickname ?? "구경하는 중"} start={start} />
      </div>
      <div className="sm:hidden">
        <PhoneTown mySlug={blog?.slug ?? null} />
      </div>
    </div>
  );
}
