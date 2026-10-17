import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { SheetLine } from "@/components/blog/SheetTitle";
import { VillageDiorama, type DioramaHouse } from "@/components/town/VillageDiorama";
import { HOUSE_NAMES, houseStage } from "@/lib/house";
import { ROOF_HEX } from "@/lib/roof";
import { safeNext } from "@/lib/safe-next";
import { enabledProviders, signInErrorMessage } from "@/lib/social-login";
import { getSession } from "@/server/dal";
import { listStarterCharacters } from "@/server/items";

const HEADLINE = "글을 쓸수록 내 마을이 자라요";

/**
 * 첫 화면 마을 그림 (광장 개편 "등불 마을"): 레벨이 오를수록 커지는 집 셋. 불은 크기와 상관없이 글을 올린 집에 켜진다
 * (작은 오두막과 2층 집은 켜고, 다락 있는 집은 끈다)
 */
const HOUSES: DioramaHouse[] = [
  { level: 1, roof: ROOF_HEX.red, fresh: true },
  { level: 20, roof: ROOF_HEX.blue, fresh: false },
  { level: 50, roof: ROOF_HEX.orange, fresh: true },
].map(({ level, roof, fresh }) => {
  const stage = houseStage(level);
  return { stage, roof, fresh, sub: `Lv.${level}`, caption: HOUSE_NAMES[stage - 1] };
});

const SCENE_LABEL = `노을 진 마을 그림: ${HOUSES.map((h) => `${h.sub} ${h.caption}`).join(", ")}. 새 글을 올린 집은 창에 불이 켜져 있어요`;

export default async function Home({ searchParams }: PageProps<"/">) {
  // 로그인하면 돌아갈 주소 (댓글·공감·헤더의 [로그인]이 붙여 보낸다). 다른 사이트 주소는 버린다.
  const query = await searchParams;
  const next = safeNext(query.next);
  const member = await getSession();
  if (member) redirect(next ?? "/town");

  // 휴대폰(한 줄)은 머리글 → 로그인 칸 → 마을 그림 순서라 첫 화면에 로그인 버튼까지 보인다 (가입이 이 화면의 일).
  // 넓은 화면은 왼쪽에 머리글과 마을 그림을 붙여 쌓고 오른쪽에 로그인 칸, 묶음을 헤더와 아래 막대 사이 가운데에 (globals.css [data-landing])
  return (
    <div className="grid items-center gap-8 py-4 md:grid-cols-[minmax(0,1fr)_380px] md:gap-x-10 md:gap-y-6 md:py-10" data-landing>
      <section aria-labelledby="landing-title" className="min-w-0 md:col-start-1 md:row-start-1 md:self-end">
        {/* 원고지 두 줄 (한 줄 9칸). 칸마다 상자라 읽는 글은 따로 준다 */}
        <h1 id="landing-title" className="sheet-wrap">
          <span className="sr-only">{HEADLINE}</span>
          <span aria-hidden="true" className="landing-sheet">
            <SheetLine text="글을 쓸수록   " size="lg" />
            <SheetLine text="내 마을이 자라요" size="lg" />
          </span>
        </h1>
        <p className="mt-4 max-w-prose text-[1.0625rem] leading-relaxed text-ink-soft">가입하면 내 블로그와 집이 생겨요. 글을 올리면 창에 불이 켜져요.</p>
      </section>
      <div className="min-w-0 md:col-start-2 md:row-span-2 md:row-start-1">
        <AuthPanel
          next={next}
          characters={await listStarterCharacters()}
          providers={enabledProviders(process.env)}
          socialError={signInErrorMessage(query.error)}
        />
      </div>
      <div className="px-box min-w-0 overflow-hidden md:col-start-1 md:row-start-2 md:self-start">
        <VillageDiorama houses={HOUSES} sky="dusk" cell={4} label={SCENE_LABEL} />
      </div>
    </div>
  );
}
