import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HeaderLoginLink } from "@/components/auth/HeaderLoginLink";
import { SessionKeeper } from "@/components/auth/SessionKeeper";
import { AttendanceDayWatcher } from "@/components/game/AttendanceDayWatcher";
import { LevelUpDialog } from "@/components/game/LevelUpDialog";
import { MainNav } from "@/components/layout/MainNav";
import { PhoneTabs } from "@/components/layout/PhoneTabs";
import { UserMenu } from "@/components/layout/UserMenu";
import { SiteNoticeBar } from "@/components/layout/SiteNoticeBar";
import { SupportLink } from "@/components/layout/SupportLink";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import { UpdatesNewBadge } from "@/components/layout/UpdatesNewBadge";
import { PixelLayers } from "@/components/game/PixelLayers";
import { PixelArtSvg } from "@/components/game/PixelArtSvg";
import { houseMarkArt } from "@/lib/art/site";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { getMyBlog, getNickname, getSession } from "@/server/dal";
import { formatNumber } from "@/lib/game";
import { todayKST } from "@/lib/kst";
import { countUnreadNotifications, getPendingLevelUp } from "@/server/notifications";
import { ensureTodayAttendanceOnce } from "@/server/attendance";
import { getAvatar } from "@/server/items";
import { getWallet } from "@/server/points";
import { siteUrl } from "@/lib/feed";
import { noticeDismissKey } from "@/lib/admin-rules";
import { getActiveNotice } from "@/server/admin-tools";
import { foodEnabled } from "@/server/food";
// 한글 글꼴 Pretendard는 이 사이트에서 직접 내려준다. 글자 범위별로 쪼갠 파일이라 화면에 쓰인 글자 몫만 받고,
// 첫 화면을 막지 않게 LateFonts가 그린 뒤에 불러온다
import { LateFonts } from "@/components/layout/LateFonts";
import "./globals.css";
import "./post-extras.css";
import "./theme-dark.css";
import "./blog-design.css";
import "./town-kit.css";

// metadataBase는 실행할 때의 사이트 주소로 정한다 (공유 미리보기의 사진·주소를 절대 주소로)
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(siteUrl()),
    title: "Blogville",
    description: "글을 쓸수록 내 마을이 자라는 블로그",
    openGraph: { siteName: "Blogville", locale: "ko_KR", type: "website" },
  };
}

// 휴대폰 브라우저 주소창 색: 밝은 화면·어두운 화면(theme-dark.css)의 바탕색
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#15171a" },
  ],
};

/** 그날 처음 그리는 헤더가 자동 출석을 기록한다 (GAME-04). 실패해도 화면은 그대로 열린다 */
async function attendToday(userId: string, sessionId: string) {
  try {
    await ensureTodayAttendanceOnce(userId, sessionId);
  } catch (error) {
    console.error("자동 출석 실패", error);
  }
}

const HEADER = "sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/75";
const LOGO = "flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap sm:gap-1.5 text-xl font-extrabold tracking-tight text-accent";

/**
 * 로고 앞 도트 집 (파비콘·홈 화면 아이콘과 같은 그림, 칸 하나 2px). 먹선은 글자색이라 어두운 화면에서 밝아진다. 읽는 이름은 'Blogville' 그대로.
 * 1024px 미만에서는 숨긴다: 집 마크 자리(28px + 사이)만큼 넓어지면 360px 회원 헤더의 Lv 칩이 두 줄로 접히고, 375px 방문자 헤더(맛집 메뉴까지)와
 * 태블릿 폭 회원 헤더(메뉴 글자·글쓰기 글자·긴 닉네임이 나오는 폭)가 옆으로 넘쳤다. 휴대폰 헤더의 사이·메뉴 여백도 조금씩 줄여 두었다 (큰 레벨·코인 자리)
 */
function LogoMark() {
  return <PixelArtSvg art={houseMarkArt()} cell={2} className="text-ink max-lg:hidden" />;
}

/** 헤더를 그리는 동안 자리를 지키는 막대 (로고만). 본문은 헤더를 기다리지 않고 먼저 그린다 */
function HeaderFallback() {
  return (
    <header className={HEADER} aria-busy="true">
      <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
        <Link href="/" className={LOGO}>
          <LogoMark />
          Blogville
        </Link>
      </div>
    </header>
  );
}

/**
 * 맨 위 막대 (티스토리·네이버 블로그·velog처럼 세 덩어리):
 *  왼쪽  로고 + 큰 메뉴(마을·마을 소식·인기 글, 지금 보는 곳 밑줄)
 *  오른쪽 레벨·코인 칩, 🔔 알림, ✏️ 글쓰기, 내 캐릭터 버튼 → 내 메뉴(내 블로그·관리·내 정보·상점·출석·관리자·로그아웃)
 * 화면을 내리면 위에 붙어 있다. 휴대폰 회원은 큰 메뉴·알림이 아래 탭에 있어 헤더에서 뺀다.
 */
async function Header() {
  // 출석은 RootLayout이 먼저 했다 (코인·레벨에 오늘 보상이 들어 있다)
  const member = await getSession();
  const [blog, unread, wallet, avatar, levelUp, nickname] = member
    ? await Promise.all([
        getMyBlog(member.userId),
        countUnreadNotifications(member.userId),
        getWallet(member.userId),
        getAvatar(member.userId),
        getPendingLevelUp(member.userId),
        getNickname(member.userId),
      ])
    : [null, 0, null, null, null, ""];
  return (
    <>
    <header className={HEADER}>
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-1.5 px-4 sm:gap-4">
        <Link href={blog ? `/@${blog.slug}` : "/"} className={LOGO}>
          <LogoMark />
          Blogville
        </Link>
        <nav className="flex min-w-0 flex-1 items-center" aria-label="메뉴">
          <MainNav member={!!(member && blog)} food={foodEnabled()} />
          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            {member && blog && wallet ? (
              <>
                {/* 레벨·코인 (GAME-02·03), 누르면 내역 (GAME-07) */}
                <Link
                  href="/wallet"
                  className="flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm hover:bg-bg"
                  aria-label={`Lv.${wallet.progress.level}, 코인 ${formatNumber(wallet.coin)}: 경험치·코인 내역`}
                  data-wallet
                >
                  <span className="whitespace-nowrap rounded-full bg-accent/10 px-1.5 font-bold text-accent">Lv.{wallet.progress.level}</span>
                  <span className="whitespace-nowrap font-semibold tabular-nums">🪙 {formatNumber(wallet.coin)}</span>
                </Link>
                <span className="contents max-sm:hidden">
                  <NotificationBell unread={{ count: unread }} iconOnly className="relative flex size-11 items-center justify-center rounded-full text-lg hover:bg-bg" />
                </span>
                {/* 768px 미만은 ✏️만 (태블릿 폭에서 메뉴 글자와 함께 헤더가 넘치지 않게) */}
                <Link href="/write" className="btn btn-primary gap-1 rounded-full px-4 max-md:size-11 max-md:px-0" aria-label="글쓰기">
                  ✏️<span className="max-md:hidden">글쓰기</span>
                </Link>
                <UserMenu
                  userId={member.userId}
                  nickname={nickname}
                  slug={blog.slug}
                  isAdmin={member.role === "admin"}
                  level={wallet.progress.level}
                  ratio={wallet.progress.ratio}
                  isMax={wallet.progress.isMax}
                  coin={wallet.coin}
                  // 내 캐릭터 (GAME-01), 입은 모자·옷·소품까지 (SHOP-06)
                  avatar={<PixelLayers arts={avatar?.layers ?? []} size={30} />}
                />
              </>
            ) : (
              !member && <HeaderLoginLink />
            )}
          </div>
        </nav>
      </div>
    </header>
    {/* 헤더 막대가 없는 마을에서도 동작하도록 헤더 밖에 둔다 (TOWN-01) */}
    {member && (
      <>
        {member.rememberMe && <SessionKeeper />}
        <AttendanceDayWatcher day={todayKST()} />
        {/* 안 읽은 레벨업이 있으면 가운데 팝업 (GAME-06) */}
        <LevelUpDialog pending={{ levelUp }} />
      </>
    )}
    {member && blog && <PhoneTabs slug={blog.slug} unread={{ count: unread }} />}
    </>
  );
}

/** 사이트 공지 띠 (ADM-04): 관리자가 켜 둔 공지가 있을 때만 */
async function NoticeBar() {
  const notice = await getActiveNotice();
  if (!notice) return null;
  return <SiteNoticeBar key={notice.updatedAt.getTime()} text={notice.text} link={notice.link} dismissKey={noticeDismissKey(notice.updatedAt)} />;
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // 헤더와 화면의 코인·레벨이 오늘 출석 보상까지 반영되게 본문보다 먼저 한다 (이미 했으면 읽기 한 번)
  const member = await getSession();
  if (member) await attendToday(member.userId, member.sessionId);
  return (
    // 고른 화면 밝기는 그리기 전에 스크립트가 data-theme으로 붙인다 (서버 HTML과 달라도 괜찮다)
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <LateFonts />
        {/* 공지 띠·헤더(세션·출석·코인·알림 읽기)를 본문과 따로 그려서, 본문이 헤더 쿼리를 기다리지 않는다 */}
        <Suspense fallback={null}>
          <NoticeBar />
        </Suspense>
        <Suspense fallback={<HeaderFallback />}>
          <Header />
        </Suspense>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        {/* 아래 막대 (SUP-01): 업데이트 소식(릴리스 노트, /updates)과 버그·문의(/support). 마을(PC)에서는 CSS가 숨긴다 */}
        <footer className="site-footer border-t border-line bg-surface">
          <nav aria-label="소식과 문의" className="mx-auto grid max-w-5xl grid-cols-2 gap-2 px-4 py-3 sm:flex sm:items-center sm:justify-end">
            <span className="mr-auto hidden text-sm text-ink-soft sm:inline">Blogville</span>
            <ThemeToggle className="btn btn-ghost col-span-2 min-w-0 px-3 text-sm sm:col-span-1" />
            <Link href="/updates" className="btn min-w-0 px-3 text-sm font-semibold" data-updates-link>
              <span className="truncate">🆕 업데이트 소식</span>
              <Suspense fallback={null}>
                <UpdatesNewBadge />
              </Suspense>
            </Link>
            <SupportLink className="btn btn-primary min-w-0 px-3 text-sm font-semibold" />
          </nav>
        </footer>
      </body>
    </html>
  );
}
