"use client";

import { useActionState } from "react";
import { farmAction, type FarmState } from "@/app/farm/actions";
import { PixelLayers } from "@/components/game/PixelLayers";
import { animalStage, CARE_ACTIONS, CARE_CODES, EGG_PRICE, MAX_ACTIVE_ANIMALS, SPECIES, STAGE_LABEL, type Species } from "@/lib/farm";
import type { Farm, FarmAnimal } from "@/server/farm";

const STAGE_SIZE = { baby: 56, teen: 72, adult: 88 } as const;
const dayFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });

/**
 * 농장 화면 (TOWN-09). 버튼마다 같은 Action을 `intent`로 부른다.
 * 보내는 동안에는 모든 버튼을 잠가 두 번 눌러도 한 번만 보낸다.
 */
export function FarmView({ farm }: { farm: Farm }) {
  const [state, action, pending] = useActionState<FarmState, FormData>(farmAction, null);
  const active = farm.eggs.length + farm.animals.length;
  const full = active >= MAX_ACTIVE_ANIMALS;

  return (
    <div className="space-y-6">
      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`sticky top-0 z-10 rounded-xl border px-4 py-3 font-semibold shadow-sm ${state.ok ? "border-green-300 bg-green-50 text-green-800" : "border-red-300 bg-red-50 text-red-700"}`}
          data-farm-result={state.ok ? "ok" : "error"}
        >
          {state.message}
        </p>
      )}

      <section aria-labelledby="farm-eggs" className="rounded-2xl border border-line bg-surface p-4">
        <h2 id="farm-eggs" className="font-bold">
          🥚 알 받기 <span className="text-sm font-normal text-ink-soft">(키우는 중 {active}/{MAX_ACTIVE_ANIMALS})</span>
        </h2>
        {full && <p className="mt-1 text-sm text-ink-soft">자리가 꽉 찼어요. 다 키운 뒤에 받을 수 있어요</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {farm.freeEggs.map((egg) => (
            <form key={egg} action={action}>
              <input type="hidden" name="intent" value="claim" />
              <input type="hidden" name="egg" value={egg} />
              <button type="submit" className="btn btn-primary" disabled={full || pending}>
                {egg === "first" ? "🎁 농장 첫 알 (무료)" : `🎁 레벨 ${egg} 보상 알 (무료)`}
              </button>
            </form>
          ))}
          <form action={action}>
            <input type="hidden" name="intent" value="buy" />
            <button type="submit" className="btn" disabled={full || farm.coins < EGG_PRICE || pending}>
              🪙 {EGG_PRICE}으로 알 사기
            </button>
          </form>
        </div>
        <p className="mt-2 text-sm text-ink-soft">레벨 5, 10, 15…가 될 때마다 무료 알을 하나씩 받아요.</p>
      </section>

      <section aria-labelledby="farm-pen">
        <h2 id="farm-pen" className="text-lg font-bold">
          🌾 우리 농장
        </h2>
        {active === 0 ? (
          <p className="mt-2 text-ink-soft">아직 키우는 동물이 없어요. 알을 받아 부화시켜 보세요.</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {farm.eggs.map((egg) => (
              <li key={egg.id} className="flex flex-col items-center rounded-2xl border border-line bg-surface p-4" data-egg={egg.id} aria-label="알">
                <PixelLayers arts={["animal.egg"]} size={64} label="알" />
                <h3 className="mt-2 font-bold">알</h3>
                <p className="text-sm text-ink-soft">무엇이 나올까요?</p>
                <form action={action} className="mt-3 w-full">
                  <input type="hidden" name="intent" value="hatch" />
                  <input type="hidden" name="id" value={egg.id} />
                  <button type="submit" className="btn btn-primary w-full" disabled={pending}>
                    🐣 부화시키기
                  </button>
                </form>
              </li>
            ))}
            {farm.animals.map((animal) => (
              <AnimalCard key={animal.id} animal={animal} action={action} pending={pending} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="farm-grown">
        <h2 id="farm-grown" className="text-lg font-bold">
          🏅 다 키운 동물 <span className="text-sm font-normal text-ink-soft">({farm.grown.length})</span>
        </h2>
        {farm.grown.length === 0 ? (
          <p className="mt-2 text-ink-soft">다 키운 동물이 카드로 여기에 모여요.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {farm.grown.map((a) => (
              <li key={a.id} className="flex flex-col items-center rounded-2xl border-2 border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/30" data-grown={a.species}>
                <PixelLayers arts={[`animal.${a.species}`]} size={64} label={SPECIES[a.species].name} />
                <p className="mt-1 font-bold">🎀 {SPECIES[a.species].name}</p>
                <p className="text-xs text-ink-soft">{dayFormat.format(a.grownAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AnimalCard({ animal, action, pending }: { animal: FarmAnimal; action: (formData: FormData) => void; pending: boolean }) {
  const s = SPECIES[animal.species as Species];
  const stage = animalStage(animal.species, animal.growth);
  return (
    <li className="flex flex-col items-center rounded-2xl border border-line bg-surface p-4" data-animal={animal.species} aria-label={s.name}>
      <div className="flex h-24 items-end">
        <PixelLayers arts={[`animal.${animal.species}`]} size={STAGE_SIZE[stage]} label={`${s.name} (${STAGE_LABEL[stage]})`} />
      </div>
      <h3 className="mt-2 font-bold">
        {s.name} <span className="rounded-full bg-accent/10 px-1.5 text-sm text-accent">{STAGE_LABEL[stage]}</span>
      </h3>
      <label className="mt-2 w-full text-sm">
        <span className="flex justify-between text-ink-soft">
          성장 <span data-growth>{animal.growth}/{s.growth}</span>
        </span>
        <progress className="h-2 w-full accent-green-600" value={animal.growth} max={s.growth} />
      </label>
      <div className="mt-3 grid w-full grid-cols-3 gap-1">
        {CARE_CODES.map((code) => {
          const cared = animal.cared.includes(code);
          return (
            <form key={code} action={action}>
              <input type="hidden" name="intent" value="care" />
              <input type="hidden" name="id" value={animal.id} />
              <input type="hidden" name="action" value={code} />
              <button
                type="submit"
                className="btn w-full px-1 text-sm"
                disabled={cared || pending}
                aria-label={cared ? `${CARE_ACTIONS[code].name} 완료` : CARE_ACTIONS[code].button}
              >
                {cared ? "✓ 완료" : CARE_ACTIONS[code].button}
              </button>
            </form>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        다 키우면 ✨ {s.exp} · 🪙 {s.coin}
      </p>
    </li>
  );
}
