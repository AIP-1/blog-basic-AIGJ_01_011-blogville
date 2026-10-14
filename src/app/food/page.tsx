import type { Metadata } from "next";
import Link from "next/link";
import { NearbyLocator } from "@/components/food/NearbyLocator";
import { VERDICT_LABELS } from "@/lib/food-relevance";
import {
  FOOD_KINDS,
  FOOD_RADII,
  isFoodKind,
  parseRadius,
  radiusLabel,
  type FoodKindFilter,
} from "@/lib/food-kind";
import {
  FocusOnMapButton,
  FoodMap,
  type MapProvider,
} from "@/components/food/FoodMap";
import { InterestSpark } from "@/components/food/InterestSpark";
import { PlaceCard } from "@/components/food/PlaceCard";
import { ReviewCards } from "@/components/food/ReviewCards";
import { SaveButton } from "@/components/food/SaveButton";
import { SavedList } from "@/components/food/SavedList";
import {
  buzzLabel,
  FOOD_MESSAGES,
  FOOD_REGION_TOP,
  FOOD_QUERY_MAX,
  FOOD_REGIONS,
  FOOD_AREAS,
  isFoodArea,
  FOOD_TABS,
  isFoodRegion,
  isFoodTab,
  parseCoords,
  parseFoodQuery,
  reviewWriteHref,
  type FoodPlace,
  type FoodTab,
} from "@/lib/food";
import { loginHref } from "@/lib/safe-next";
import { formatDate } from "@/lib/time";
import { getSession } from "@/server/dal";
import { listSavedPlaces, savedPlaceIds } from "@/server/food-saved";
import {
  foodEnabled,
  kakaoEnabled,
  naverFoodEnabled,
  nearbyPlaces,
  placeDetail,
  placeInterest,
  regionHot,
  searchPlaces,
  type FoodResult,
} from "@/server/food";

export const metadata: Metadata = {
  title: "🍽 맛집 | Blogville",
  description:
    "내 주변 식당, 지역별 요즘 많이 찾는 식당, 식당 블로그 후기를 한곳에서",
};

const DEFAULT_REGION = "서울";

/** 🗺 지도: 네이버 지도 Client ID가 있으면 네이버 먼저, 실패하면 카카오 (둘 다 없으면 지도 없이 목록만) */
function mapProviders(): MapProvider[] | null {
  const list: MapProvider[] = [];
  if (process.env.NAVER_MAP_CLIENT_ID)
    list.push({ kind: "naver", key: process.env.NAVER_MAP_CLIENT_ID });
  if (process.env.KAKAO_JS_KEY)
    list.push({ kind: "kakao", key: process.env.KAKAO_JS_KEY });
  return list.length ? list : null;
}

function detailHref(q: string, p: FoodPlace) {
  return `/food?tab=search&q=${encodeURIComponent(q)}&place=${encodeURIComponent(p.id)}`;
}

/** 보이는 식당마다 [☆ 가고 싶어요] 버튼 (저장했는지 한 번에 묻는다) */
async function saveButtons(
  places: FoodPlace[],
): Promise<(p: FoodPlace) => React.ReactNode> {
  const member = await getSession();
  const saved = await savedPlaceIds(
    member?.userId ?? null,
    places.map((p) => p.id),
  );
  return function save(p) {
    return <SaveButton place={p} saved={saved.has(p.id)} />;
  };
}

/** 동그란 고르기 단추 줄 (거리·분류) */
function Chips({
  label,
  items,
}: {
  label: string;
  items: { href: string; text: string; on: boolean; data?: string }[];
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={it.on ? "page" : undefined}
          data-chip={it.data}
          className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm ${it.on ? "border-ink bg-ink font-bold text-surface" : "border-line hover:border-accent"}`}
        >
          {it.text}
        </Link>
      ))}
    </nav>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-line p-8 text-center text-ink-soft">
      {children}
    </div>
  );
}

function failText(r: FoodResult<unknown>): string {
  return r.status === "forbidden"
    ? FOOD_MESSAGES.forbidden
    : r.status === "off"
      ? FOOD_MESSAGES.off
      : FOOD_MESSAGES.error;
}

// 🍽 맛집: 📍 내 주변(카카오) · 🔥 지역 인기(네이버 지역·블로그) · 🔎 식당 찾기(정보 + 블로그 후기 + 이웃 글). 로그인 필요 없음
export default async function FoodPage({ searchParams }: PageProps<"/food">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const tab: FoodTab = isFoodTab(one(sp.tab))
    ? (one(sp.tab) as FoodTab)
    : "near";

  return (
    <section
      aria-labelledby="food-title"
      className="mx-auto max-w-3xl min-w-0"
      data-food-tab={tab}
    >
      <h1 id="food-title" className="text-2xl font-extrabold">
        🍽 맛집
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        내 주변 식당, 지역에서 요즘 많이 찾는 곳, 식당 블로그 후기를 한곳에서
        봐요.
      </p>
      <nav aria-label="맛집 탭" className="mt-3 flex flex-wrap gap-2">
        {FOOD_TABS.map((t) => (
          <Link
            key={t.key}
            href={`/food?tab=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={`btn ${t.key === tab ? "btn-current" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "saved" ? (
        <SavedTab />
      ) : !foodEnabled() ? (
        <Notice>{FOOD_MESSAGES.off}</Notice>
      ) : tab === "near" ? (
        <NearTab
          lat={one(sp.lat)}
          lng={one(sp.lng)}
          sort={one(sp.sort) === "buzz" ? "buzz" : "distance"}
          radius={parseRadius(one(sp.r))}
          kind={
            isFoodKind(one(sp.kind)) ? (one(sp.kind) as FoodKindFilter) : "all"
          }
          page={Number(one(sp.p)) || 1}
        />
      ) : tab === "region" ? (
        <RegionTab
          region={
            isFoodRegion(one(sp.region)) ? one(sp.region)! : DEFAULT_REGION
          }
          area={one(sp.area)}
          kind={
            isFoodKind(one(sp.kind)) ? (one(sp.kind) as FoodKindFilter) : "all"
          }
        />
      ) : (
        <SearchTab
          q={parseFoodQuery(one(sp.q))}
          placeId={one(sp.place) ?? null}
          kind={
            isFoodKind(one(sp.kind)) ? (one(sp.kind) as FoodKindFilter) : "all"
          }
          reviewPage={Number(one(sp.rp)) || 1}
        />
      )}
    </section>
  );
}

async function NearTab({
  lat,
  lng,
  sort,
  radius,
  kind,
  page,
}: {
  lat?: string;
  lng?: string;
  sort: "distance" | "buzz";
  radius: number;
  kind: FoodKindFilter;
  page: number;
}) {
  if (!kakaoEnabled()) return <Notice>{FOOD_MESSAGES.nearOff}</Notice>;
  const at = parseCoords(lat, lng);
  const result = at ? await nearbyPlaces(at, sort, radius, kind, page) : null;
  const href = (o: { sort?: string; r?: number; kind?: string; p?: number }) => {
    const q = new URLSearchParams({
      tab: "near",
      lat: String(at!.lat),
      lng: String(at!.lng),
    });
    const r = o.r ?? radius;
    const k = o.kind ?? kind;
    const so = o.sort ?? sort;
    if (r !== 500) q.set("r", String(r));
    if (k !== "all") q.set("kind", k);
    if (so === "buzz") q.set("sort", "buzz");
    if (o.p && o.p > 1) q.set("p", String(o.p));
    return `/food?${q}`;
  };
  const base = at ? href({ sort: "distance" }) : "";
  const list = result?.status === "ok" ? result.value : null;
  const save = await saveButtons(list?.items ?? []);
  return (
    <div className="mt-4 space-y-3">
      <NearbyLocator sort={sort} located={!!at} radius={radius} kind={kind} />
      {at && (
        <div
          className="space-y-2 rounded-xl border border-line bg-surface p-3"
          data-near-filters
        >
          <Chips
            label="거리"
            items={FOOD_RADII.map((r) => ({
              href: href({ r }),
              text: `${radiusLabel(r)} 안`,
              on: r === radius,
              data: `r-${r}`,
            }))}
          />
          <Chips
            label="분류"
            items={FOOD_KINDS.map((k) => ({
              href: href({ kind: k.key }),
              text: `${k.icon} ${k.label}`,
              on: k.key === kind,
              data: `kind-${k.key}`,
            }))}
          />
        </div>
      )}
      {at && (
        <nav aria-label="정렬" className="flex gap-2 text-sm">
          <Link
            href={base}
            aria-current={sort === "distance" ? "page" : undefined}
            className={`btn ${sort === "distance" ? "btn-current" : ""}`}
          >
            가까운 순
          </Link>
          {naverFoodEnabled() && (
            <Link
              href={href({ sort: "buzz" })}
              aria-current={sort === "buzz" ? "page" : undefined}
              className={`btn ${sort === "buzz" ? "btn-current" : ""}`}
            >
              요즘 블로그에 많이 올라온 순
            </Link>
          )}
        </nav>
      )}
      {result &&
        (result.status !== "ok" ? (
          <Notice>{failText(result)}</Notice>
        ) : list!.total === 0 ? (
          <Notice>
            {radiusLabel(radius)} 안에{" "}
            {kind === "all"
              ? "가게"
              : FOOD_KINDS.find((k) => k.key === kind)!.label}
            가 안 보여요.{" "}
            {radius < 2000 && (
              <Link
                href={href({
                  r: FOOD_RADII[
                    FOOD_RADII.indexOf(radius as (typeof FOOD_RADII)[number]) +
                      1
                  ],
                })}
                className="underline"
              >
                더 넓게 찾기
              </Link>
            )}
          </Notice>
        ) : (
          <>
            <p className="text-sm text-ink-soft" data-near-count>
              {radiusLabel(radius)} 안{" "}
              {kind === "all"
                ? "가게"
                : FOOD_KINDS.find((k) => k.key === kind)!.label}{" "}
              {list!.total}곳{list!.total >= 200 ? " (가까운 200곳까지)" : ""}
              {list!.pages > 1 && ` · ${(list!.page - 1) * 20 + 1}~${(list!.page - 1) * 20 + list!.items.length}번째`}
            </p>
            {mapProviders() && (
              <FoodMap
                providers={mapProviders()!}
                places={list!.items}
                me={at}
                researchSort={sort}
                firstNumber={(list!.page - 1) * 20 + 1}
              />
            )}
            <ol className="space-y-3" data-food-list="near">
              {list!.items.map((p, i) => (
                <li key={p.id}>
                  <PlaceCard
                    place={p}
                    rank={mapProviders() ? (list!.page - 1) * 20 + i + 1 : undefined}
                    recent={naverFoodEnabled() ? p.recent : undefined}
                    detailHref={detailHref(p.name, p)}
                    actions={save(p)}
                  />
                  {mapProviders() && p.lat !== null && (
                    <FocusOnMapButton id={p.id} />
                  )}
                </li>
              ))}
            </ol>
            {list!.pages > 1 && (
              <nav aria-label="쪽" className="flex flex-wrap justify-center gap-1" data-near-pages>
                {Array.from({ length: list!.pages }, (_, i) => i + 1).map((n) => (
                  <Link
                    key={n}
                    href={href({ p: n })}
                    aria-current={n === list!.page ? "page" : undefined}
                    className={`inline-flex size-9 items-center justify-center rounded-lg text-sm ${n === list!.page ? "bg-ink font-bold text-surface" : "hover:bg-bg"}`}
                  >
                    {n}
                  </Link>
                ))}
              </nav>
            )}
          </>
        ))}
    </div>
  );
}

async function RegionTab({
  region,
  area: rawArea,
  kind,
}: {
  region: string;
  area?: string;
  kind: FoodKindFilter;
}) {
  if (!naverFoodEnabled()) return <Notice>{FOOD_MESSAGES.off}</Notice>;
  const area = isFoodArea(region, rawArea) ? rawArea : null;
  const place = area ?? region;
  const result = await regionHot(place);
  const list =
    result.status === "ok"
      ? result.value
          .filter((p) => kind === "all" || p.kind === kind)
          .slice(0, FOOD_REGION_TOP)
      : [];
  const save = await saveButtons(list);
  const href = (r: string, k: FoodKindFilter, a: string | null = null) =>
    `/food?tab=region&region=${encodeURIComponent(r)}${a ? `&area=${encodeURIComponent(a)}` : ""}${k === "all" ? "" : `&kind=${k}`}`;
  return (
    <div className="mt-4 space-y-3">
      <nav aria-label="지역" className="flex flex-wrap gap-1.5">
        {FOOD_REGIONS.map((r) => (
          <Link
            key={r}
            href={href(r, kind)}
            aria-current={r === region ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${r === region ? "border-ink bg-ink font-bold text-surface" : "border-line hover:border-accent"}`}
          >
            {r}
          </Link>
        ))}
      </nav>
      {isFoodRegion(region) && (
        <Chips
          label="동네"
          items={[null, ...FOOD_AREAS[region]].map((a) => ({
            href: href(region, kind, a),
            text: a ? `📍 ${a}` : `${region} 전체`,
            on: a === area,
            data: `area-${a ?? "all"}`,
          }))}
        />
      )}
      <Chips
        label="분류"
        items={FOOD_KINDS.map((k) => ({
          href: href(region, k.key, area),
          text: `${k.icon} ${k.label}`,
          on: k.key === kind,
          data: `kind-${k.key}`,
        }))}
      />
      <p className="text-sm text-ink-soft">
        {place}에서 후기가 많은 식당·카페를 모아{" "}
        <strong className="text-ink">
          최근 한 달 진짜 후기 수와 네이버 검색 관심도
        </strong>
        를 반씩 섞은 순으로 보여 줘요. 백화점·쇼핑몰·큰 체인점은 빼고,
        체험단·협찬 글과 가게 이야기가 아닌 글은 세지 않아요.
      </p>
      {result.status !== "ok" ? (
        <Notice>{failText(result)}</Notice>
      ) : list.length === 0 ? (
        <Notice>{FOOD_MESSAGES.empty}</Notice>
      ) : (
        <>
          {mapProviders() && list.some((p) => p.lat !== null) && (
            <FoodMap providers={mapProviders()!} places={list} />
          )}
          <ol className="space-y-3" data-food-list="region">
            {list.map((p, i) => (
              <li key={p.id}>
                <PlaceCard
                  place={p}
                  recent={p.recent}
                  rank={i + 1}
                  detailHref={detailHref(p.name, p)}
                  actions={
                    <>
                      {p.rising && (
                        <span
                          className="self-center rounded-full border border-accent/40 px-2 py-0.5 text-xs font-bold text-ink"
                          data-food-rising
                        >
                          🔎 검색 관심 ↑
                        </span>
                      )}
                      {save(p)}
                    </>
                  }
                />
                {mapProviders() && p.lat !== null && (
                  <FocusOnMapButton id={p.id} />
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

async function SearchTab({
  q,
  placeId,
  kind,
  reviewPage,
}: {
  q: string | null;
  placeId: string | null;
  kind: FoodKindFilter;
  reviewPage: number;
}) {
  const result = q ? await searchPlaces(q, placeId ? "all" : kind) : null;
  const kindHref = (k: string) =>
    `/food?tab=search&q=${encodeURIComponent(q ?? "")}${k === "all" ? "" : `&kind=${k}`}`;
  const picked =
    result?.status === "ok" && placeId
      ? (result.value.find((p) => p.id === placeId) ?? null)
      : null;
  const save = await saveButtons(result?.status === "ok" ? result.value : []);
  return (
    <div className="mt-4 space-y-3">
      <form action="/food" className="flex gap-2" role="search">
        <input type="hidden" name="tab" value="search" />
        <input
          name="q"
          defaultValue={q ?? ""}
          maxLength={FOOD_QUERY_MAX}
          placeholder="식당 이름 (예: 광주 영미오리탕)"
          aria-label="식당 이름"
          className="field min-w-0 flex-1"
          type="search"
          required
        />
        <button type="submit" className="btn btn-primary">
          찾기
        </button>
      </form>
      {picked ? (
        <PlaceDetailView
          place={picked}
          backHref={`/food?tab=search&q=${encodeURIComponent(q!)}`}
          actions={save(picked)}
          page={reviewPage}
        />
      ) : (
        result &&
        (result.status !== "ok" ? (
          <Notice>{failText(result)}</Notice>
        ) : result.value.length === 0 ? (
          <Notice>{FOOD_MESSAGES.empty}</Notice>
        ) : (
          <>
            <Chips
              label="분류"
              items={FOOD_KINDS.map((k) => ({
                href: kindHref(k.key),
                text: `${k.icon} ${k.label}`,
                on: k.key === kind,
                data: `kind-${k.key}`,
              }))}
            />
            <ul className="space-y-3" data-food-list="search">
              {result.value.map((p) => (
                <li key={p.id}>
                  <PlaceCard
                    place={p}
                    detailHref={detailHref(q!, p)}
                    actions={save(p)}
                  />
                </li>
              ))}
            </ul>
          </>
        ))
      )}
    </div>
  );
}

async function PlaceDetailView({
  place,
  backHref,
  actions,
  page,
}: {
  place: FoodPlace;
  backHref: string;
  actions: React.ReactNode;
  page: number;
}) {
  const [d, interest] = await Promise.all([
    placeDetail(place, page),
    placeInterest(place),
  ]);
  const pageHref = (n: number) =>
    `${backHref}&place=${encodeURIComponent(place.id)}${n > 1 ? `&rp=${n}` : ""}#food-reviews`;
  return (
    <div className="space-y-4" data-food-detail={place.id}>
      <Link href={backHref} className="text-sm text-ink-soft hover:underline">
        ← 검색 결과로
      </Link>
      <PlaceCard
        place={place}
        recent={d.reviews.status === "ok" ? d.recent : undefined}
        actions={actions}
      />
      {mapProviders() && place.lat !== null && (
        <FoodMap providers={mapProviders()!} places={[place]} />
      )}
      {interest && <InterestSpark interest={interest} />}

      {d.local.length > 0 && (
        <section
          aria-labelledby="food-local"
          className="rounded-xl border border-line bg-surface p-4"
        >
          <h2 id="food-local" className="font-bold">
            🏘 Blogville 이웃 후기
          </h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {d.local.map((p) => (
              <li key={p.id} className="flex gap-2">
                <Link
                  href={`/@${p.slug}/${p.id}`}
                  className="min-w-0 flex-1 truncate font-medium hover:underline"
                >
                  {p.title}
                </Link>
                <span className="shrink-0 text-ink-soft">
                  {p.nickname} · {formatDate(p.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        aria-labelledby="food-reviews"
        className="rounded-xl border border-line bg-surface p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="food-reviews" className="font-bold">
            📝 네이버 블로그 후기
          </h2>
          {d.reviews.status === "ok" && (
            <span className="text-xs text-ink-soft">{buzzLabel(d.recent)}</span>
          )}
        </div>
        {d.reviews.status !== "ok" ? (
          <p className="mt-2 text-sm text-ink-soft">
            {d.reviews.status === "off"
              ? "블로그 후기는 준비 중이에요."
              : failText(d.reviews)}
          </p>
        ) : d.reviews.value.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">
            아직 블로그 후기가 없어요. 첫 후기를 남겨 보세요!
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-ink-soft" data-review-count>
              그 식당 이야기로 보이는 글 {d.reviewTotal}편
              {d.reviewHidden > 0 &&
                ` · 이름만 같거나 광고로 보이는 글 ${d.reviewHidden}편은 뺐어요`}
            </p>
            <ReviewCards reviews={d.reviews.value} />
            {d.hiddenSample.length > 0 && (
              <details className="mt-3 rounded-lg bg-bg px-3 py-2 text-sm" data-hidden-reviews>
                <summary className="cursor-pointer text-ink-soft">뺀 글 {d.reviewHidden}편 중 {d.hiddenSample.length}편 보기 (왜 뺐는지)</summary>
                <ul className="mt-2 space-y-1">
                  {d.hiddenSample.map((h) => (
                    <li key={h.url} className="flex items-center gap-2">
                      <span className="shrink-0 rounded-full border border-line px-1.5 text-xs text-ink-soft">{VERDICT_LABELS[h.reason]}</span>
                      <a href={h.url} target="_blank" rel="noopener noreferrer nofollow" className="min-w-0 truncate hover:underline">
                        {h.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {d.reviewPages > 1 && (
              <nav
                aria-label="후기 쪽"
                className="mt-3 flex flex-wrap justify-center gap-1"
                data-review-pages
              >
                {Array.from({ length: d.reviewPages }, (_, i) => i + 1).map(
                  (n) => (
                    <Link
                      key={n}
                      href={pageHref(n)}
                      aria-current={n === d.reviewPage ? "page" : undefined}
                      className={`inline-flex size-9 items-center justify-center rounded-lg text-sm ${n === d.reviewPage ? "bg-ink font-bold text-surface" : "hover:bg-bg"}`}
                    >
                      {n}
                    </Link>
                  ),
                )}
              </nav>
            )}
          </>
        )}
      </section>

      <Link
        href={reviewWriteHref(place)}
        className="btn btn-primary w-full justify-center"
      >
        ✏ 이 식당 후기 쓰기
      </Link>
    </div>
  );
}

async function SavedTab() {
  const member = await getSession();
  if (!member) {
    return (
      <Notice>
        <Link
          href={loginHref("/food?tab=saved")}
          className="font-semibold text-accent underline"
        >
          로그인
        </Link>
        하면 가고 싶은 곳을 모아 볼 수 있어요.
      </Notice>
    );
  }
  return (
    <div className="mt-4">
      <SavedList places={await listSavedPlaces(member.userId)} />
    </div>
  );
}
