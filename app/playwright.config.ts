import { defineConfig, devices } from "@playwright/test";

// 이 환경처럼 브라우저가 미리 설치된 곳은 PW_CHROMIUM_PATH로 가리킨다
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: 0,
  // 개발 서버는 화면을 처음 열 때 컴파일하느라 느리다
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    launchOptions: { executablePath },
    locale: "ko-KR",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 5"], viewport: { width: 375, height: 812 } }, testMatch: /mobile\.spec/ },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
