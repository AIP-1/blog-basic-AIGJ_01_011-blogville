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
