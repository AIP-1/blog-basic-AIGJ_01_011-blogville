import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PhoneTown } from "@/components/town/PhoneTown";
import { TownGame } from "@/components/town/TownGame";
import { TownHud } from "@/components/town/TownHud";
import { unreadBadge } from "@/lib/notifications";
import { lotFront } from "@/lib/town/layout";
import { townSpots } from "@/lib/town/structures";
import { requireMember } from "@/server/dal";
import { getHudMember, getMemberHouses, getTownHost } from "@/server/town";

export async function generateMetadata({ params }: PageProps<"/town/[slug]">): Promise<Metadata> {
  const host = await getTownHost(decodeURIComponent((await params).slug));
  return { title: host ? `${host.nickname}님의 마을 | Blogville` : "마을 | Blogville" };
}

/**
 * 친구 마을 구경 (TOWN-15, specs/047-friend-town): 0번은 그 회원의 집, 1~10번은 그 회원이 즐겨찾는 이웃의 집.
 * 나는 내 캐릭터로 그 집 앞에서 시작하고, ☰ 메뉴는 내 것이다. 내 주소면 내 마을로, 없는 주소·공지 블로그는 404.
 */
export default async function FriendTownPage({ params }: PageProps<"/town/[slug]">) {
  const member = await requireMember();
  const host = await getTownHost(decodeURIComponent((await params).slug));
  if (!host) notFound();
  if (host.userId === member.userId) redirect("/town");
  const [houses, hud] = await Promise.all([getMemberHouses(host.userId, member.userId), getHudMember(member.userId)]);
  const who = { nickname: host.nickname, slug: host.slug };
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
          start={lotFront(0)}
          startKey={`host:${host.slug}`}
          place={`${host.nickname}님의 마을`}
        />
        <TownHud
          hud={hud}
          admin={member.role === "admin"}
          userId={member.userId}
          unread={unreadBadge(hud.unread)}
          spots={townSpots(houses, true)}
          houses={houses}
          host={who}
        />
      </div>
      <div className="sm:hidden">
        <PhoneTown mySlug={hud.blog.slug} host={who} />
      </div>
    </div>
  );
}
