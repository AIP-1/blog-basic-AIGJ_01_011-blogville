import { test as base, type BrowserContext, type Page } from "@playwright/test";

export * from "@playwright/test";

// 레벨업 팝업 (GAME-06)은 화면 전체를 막는 <dialog>다. 글·댓글을 쓰다 레벨이 오르는 시험이 많아,
// 팝업 자체를 보는 시험(level-up.spec)이 아니면 뜰 때마다 [확인]으로 닫고 하던 일을 잇는다.
const POPUP = "dialog[open][data-level-up]";

function closeLevelUps(page: Page) {
  void page
    .addLocatorHandler(page.locator(POPUP), async () => {
      await page.locator(POPUP).getByRole("button", { name: "확인" }).click();
    })
    .catch(() => {});
}

function watch(context: BrowserContext) {
  // 처음 온 회원에게 한 번 뜨는 "내 메뉴" 말풍선은 다른 시험을 가리지 않게 미리 본 것으로 한다.
  // 말풍선을 보는 시험(header.spec)은 show_hint=1 쿠키를 넣는다
  void context
    .addInitScript(() => {
      if (!document.cookie.includes("show_hint=1")) localStorage.setItem("bv-my-menu-hint", "1");
    })
    .catch(() => {});
  context.pages().forEach(closeLevelUps);
  context.on("page", closeLevelUps);
}

export const test = base.extend({
  context: async ({ context }, provide) => {
    watch(context);
    await provide(context);
  },
  // 시험이 직접 만드는 창(browser.newContext)에도
  browser: [
    async ({ browser }, provide) => {
      const newContext = browser.newContext.bind(browser);
      browser.newContext = async (...args) => {
        const context = await newContext(...args);
        watch(context);
        return context;
      };
      await provide(browser);
    },
    { scope: "worker" },
  ],
});
