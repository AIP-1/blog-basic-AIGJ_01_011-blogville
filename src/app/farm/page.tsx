import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FarmView } from "@/components/farm/FarmView";
import { GamePageShell } from "@/components/game/GamePageShell";
import { PixelLayers } from "@/components/game/PixelLayers";
import { farmArt } from "@/lib/art/town";
import { animalStage, SPECIES, STAGE_LABEL } from "@/lib/farm";
import { parseHostSlug } from "@/lib/town/zones";
import { requireMember } from "@/server/dal";
import { getFarm, listGrownAnimals, type FarmAnimal, type GrownAnimal } from "@/server/farm";
import { getTownHost } from "@/server/town";

export async function generateMetadata({ searchParams }: PageProps<"/farm">): Promise<Metadata> {
  const slug = parseHostSlug((await searchParams).host);
  const host = slug ? await getTownHost(slug) : null;
  return { title: host ? `${host.nickname}님의 농장 구경 | Blogville` : "동물 농장 | Blogville" };
}

const STAGE_SIZE = { baby: 56, teen: 72, adult: 88 } as const;
const dayFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });

/**
 * 동물 농장 (TOWN-09): 알을 받아 부화시키고 하루 한 번씩 돌봐 키운다. 다 키우면 보상과 카드.
 * 친구 마을 외양간에서 오면(`?host={블로그 주소}`, plaza-upgrade-2 C4) 그 주인의 농장을 읽기 전용으로 구경한다:
 * 키우는 동물·다 자란 동물 카드만 있고 돌보기·알 받기 버튼은 없다. [광장으로]는 그 친구 마을 외양간 문 앞으로.
 * 내 주소면 내 농장(/farm)으로, 없는 주소면 404.
 */
export default async function FarmPage({ searchParams }: PageProps<"/farm">) {
  const member = await requireMember();
  const { host: hostParam } = await searchParams;
  if (hostParam !== undefined) {
    const slug = parseHostSlug(hostParam);
    const host = slug ? await getTownHost(slug) : null;
    if (!host) notFound();
    if (host.userId === member.userId) redirect("/farm");
    return <FriendFarm host={host} />;
  }
  const farm = await getFarm(member.userId);

  return (
    <GamePageShell
      room="farm"
      art={farmArt()}
      description="알을 부화시키고 밥·물·쓰다듬기로 돌봐 주세요. 공개 글을 쓰면 동물들도 함께 자라요."
      wallet={{ level: farm.level, coins: farm.coins, hook: "farm" }}
    >
      <FarmView farm={farm} />
    </GamePageShell>
  );
}

/** 친구의 농장 구경 (읽기 전용) */
async function FriendFarm({ host }: { host: { userId: string; nickname: string; slug: string } }) {
  const [farm, grown] = await Promise.all([getFarm(host.userId), listGrownAnimals(host.userId)]);
  const room = { key: "farm", emoji: "🐮", title: `${host.nickname}님의 농장 구경`, spot: "farm", width: "wide" } as const;
  return (
    <GamePageShell room={room} art={farmArt()} host={host.slug} description={`${host.nickname}님이 키우는 동물을 구경해요. 돌보기는 주인만 할 수 있어요.`}>
      <div className="space-y-6" data-farm-host={host.slug}>
        <section aria-labelledby="farm-pen">
          <h2 id="farm-pen" className="text-lg font-bold">
            🌾 키우는 동물 <span className="text-sm font-normal text-ink-soft">({farm.animals.length + farm.eggs.length})</span>
          </h2>
          {farm.animals.length + farm.eggs.length === 0 ? (
            <p className="mt-2 text-ink-soft">지금은 키우는 동물이 없어요.</p>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
              {farm.eggs.map((egg) => (
                <li key={egg.id} className="px-tile flex flex-col items-center p-4" data-egg={egg.id}>
                  <div className="flex h-24 items-end">
                    <PixelLayers arts={["animal.egg"]} size={56} label="알" />
                  </div>
                  <h3 className="mt-2 font-bold">알</h3>
                  <p className="text-sm text-ink-soft">곧 부화할 거예요</p>
                </li>
              ))}
              {farm.animals.map((a) => (
                <AnimalCard key={a.id} animal={a} />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="farm-grown">
          <h2 id="farm-grown" className="text-lg font-bold">
            🏅 다 키운 동물 <span className="text-sm font-normal text-ink-soft">({grown.length})</span>
          </h2>
          {grown.length === 0 ? (
            <p className="mt-2 text-ink-soft">아직 다 키운 동물이 없어요.</p>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
              {grown.map((a) => (
                <GrownCard key={a.id} animal={a} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </GamePageShell>
  );
}

function AnimalCard({ animal }: { animal: FarmAnimal }) {
  const s = SPECIES[animal.species];
  const stage = animalStage(animal.species, animal.growth);
  return (
    <li className="px-tile flex flex-col items-center p-4" data-animal={animal.species}>
      <div className="flex h-24 items-end">
        <PixelLayers arts={[`animal.${animal.species}`]} size={STAGE_SIZE[stage]} label={`${s.name} (${STAGE_LABEL[stage]})`} />
      </div>
      <h3 className="mt-2 font-bold">
        {s.name} <span className="px-chip ml-1 align-[2px]">{STAGE_LABEL[stage]}</span>
      </h3>
      <div className="mt-2 w-full text-sm">
        <span className="flex justify-between text-ink-soft">
          성장 <span data-growth>{animal.growth}/{s.growth}</span>
        </span>
        <span
          className="px-bar mt-1.5"
          role="progressbar"
          aria-label={`${s.name} 성장`}
          aria-valuemin={0}
          aria-valuemax={s.growth}
          aria-valuenow={Math.min(animal.growth, s.growth)}
        >
          <span style={{ width: `${Math.min(100, Math.round((animal.growth / s.growth) * 100))}%` }} />
        </span>
      </div>
    </li>
  );
}

function GrownCard({ animal }: { animal: GrownAnimal }) {
  return (
    <li className="px-tile flex flex-col items-center p-3" data-tone="sun" data-grown={animal.species}>
      <PixelLayers arts={[`animal.${animal.species}`]} size={64} label={SPECIES[animal.species].name} />
      <p className="mt-1 font-bold">🎀 {SPECIES[animal.species].name}</p>
      <p className="text-xs text-ink-soft">{dayFormat.format(animal.grownAt)}</p>
    </li>
  );
}
