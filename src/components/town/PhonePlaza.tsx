import Link from "next/link";
import { unreadBadge } from "@/lib/notifications";
import { shortName } from "@/lib/town/layout";
import type { PlazaNews } from "@/lib/town/plaza";
import type { Sky } from "@/lib/town/sky";
import type { HudMember, TownHouse } from "@/server/town";
import { NotificationList } from "./NotificationList";
import { NewsList, TaskList } from "./PlazaLists";
import { VillageDiorama } from "./VillageDiorama";
import { WriteButton } from "./WriteButton";

/** 휴대폰 광장 머리 그림에 세울 이웃 집 수 (내 집 + 이만큼) */
const DIORAMA_NEIGHBORS = 4;
/** 휴대폰 광장의 새 글 수 (나머지는 '모두 보기'로) */
const PHONE_NEWS = 4;

/** 마을 장소 3×2 (게임 화면이 없는 휴대폰에서 걸어가는 대신) */
const PLACES = [
  ["/shop", "🏪", "상점"],
  ["/clothes", "👗", "옷가게"],
  ["/salon", "💇", "미용실"],
  ["/attendance", "📮", "출석"],
  ["/farm", "🐮", "동물 농장"],
  ["/fishing", "🎣", "낚시터"],
] as const;

/**
 * 휴대폰 광장 (광장 개편, TOWN-01 결정 변경 · `PHONE_PLAZA`): 640px 미만 회원의 /town. 게임 캔버스 대신 세로 한 줄로
 * 마을 그림(내 집 + 글 쓴 이웃 먼저 4채, 글 쓴 집은 불이 켜진다) → ✏️ 글쓰기(오늘 글 보상 창문 3칸) → 이웃 새 글 →
 * 오늘 할 일 → 마을 장소 → 내 우체통(최근 알림). 방문자와 친구 마을은 예전 그대로(`PhoneTown`). 시험 훅 `data-phone-plaza`.
 */
export function PhonePlaza({ hud, houses, news, sky }: { hud: HudMember; houses: readonly TownHouse[]; news: PlazaNews; sky: Sky }) {
  const mine = houses.find((h) => h.mine);
  const neighbors = houses
    .filter((h) => h.lot > 0)
    .sort((a, b) => Number(b.fresh) - Number(a.fresh) || a.lot - b.lot)
    .slice(0, DIORAMA_NEIGHBORS);
  const scene = [...(mine ? [mine] : []), ...neighbors].map((h) => ({ stage: h.stage, roof: h.roof, caption: h.mine ? "내 집" : shortName(h.nickname), fresh: h.fresh }));
  const unread = unreadBadge(hud.unread);
  const title = `${hud.nickname}님의 마을`;
  // 불 켜진 집: 24시간 안에 글을 쓴 이웃 집 (광장 개편 '등불 마을')
  const lit = houses.filter((h) => h.lot > 0 && h.fresh).length;
  const newsTitle = news.scope === "village" ? "📋 마을 소식" : "이웃 새 글";
  return (
    <div className="mx-auto max-w-md space-y-6" data-phone-plaza>
      <section aria-labelledby="plaza-title" className="px-box overflow-hidden">
        <VillageDiorama houses={scene} sky={sky} label={title} className="block w-full" />
        <div className="px-box-head flex items-center gap-2 px-3 py-2">
          <h2 id="plaza-title" className="min-w-0 flex-1 truncate font-bold">
            {title}
          </h2>
          {lit > 0 && (
            <span className="px-chip shrink-0" data-tone="sun" data-plaza-lit={lit}>
              <span aria-hidden="true">🏮 </span>불 켜진 집 {lit}채
            </span>
          )}
        </div>
      </section>

      <WriteButton rewards={hud.postRewardsToday} className="w-full" />

      <section aria-labelledby="plaza-news" className="space-y-2">
        <h2 id="plaza-news" className="font-bold">
          {newsTitle}
        </h2>
        <div className="px-box py-1">
          <NewsList news={news} compact limit={PHONE_NEWS} />
        </div>
      </section>

      <section aria-labelledby="plaza-tasks" className="space-y-2">
        <h2 id="plaza-tasks" className="font-bold">
          오늘 할 일
        </h2>
        <div className="px-box py-1">
          <TaskList tasks={hud.tasks} />
        </div>
      </section>

      <nav aria-label="마을 장소" className="grid grid-cols-3 gap-2.5 p-0.5">
        {PLACES.map(([href, icon, label]) => (
          <Link key={href} href={href} className="px-btn h-18 flex-col gap-1 px-1 text-sm">
            {/* 이모지 뒤 띄어쓰기는 이모지 칸 안에 (글자는 '🏪 상점' 그대로) */}
            <span className="text-2xl leading-none" aria-hidden="true">{`${icon} `}</span>
            {label}
          </Link>
        ))}
      </nav>

      <section aria-labelledby="plaza-mail" className="space-y-2">
        <h2 id="plaza-mail" className="flex items-center gap-2 font-bold">
          📮 내 우체통
          {unread && (
            <span className="px-chip" data-tone="alert">
              <span className="sr-only">안 읽은 알림 </span>
              {unread}
            </span>
          )}
        </h2>
        <div className="px-box p-3">
          <NotificationList notifications={hud.notifications} />
        </div>
      </section>
    </div>
  );
}
