import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // 순수 함수만 시험하므로 server-only 표시는 비운다
      "server-only": fileURLToPath(new URL("./tests/unit/empty.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    // npm run test:coverage 때만 켜진다. coverage/lcov.info는 SonarQube·SonarCloud가 읽는다(sonar-project.properties)
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/server/**/*.ts"],
      reporter: ["text-summary", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      // 품질 게이트(Sonar 열쇠가 없어도 도는 최소선): 이보다 떨어지면 npm run test:coverage가 실패해 CI check가 빨개진다.
      // 지금(2026-10-14) 문장 54%·분기 53%·함수 49%·줄 55%에서 조금 아래로 잡았다. 시험이 늘면 같이 올린다
      thresholds: { statements: 50, branches: 50, functions: 45, lines: 50 },
    },
  },
});
