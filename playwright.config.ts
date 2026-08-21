import { defineConfig, devices } from "@playwright/test";

/**
 * kpubdata-studio E2E (#268).
 *
 * 결정성 전략: vite dev 서버를 VITE_USE_REAL_BUILDER 미설정(mock)으로 띄운다 —
 * 화면은 deterministic mock fixture로 동작하므로 네트워크·Builder 상태와
 * 무관하게 안정적으로 검증한다. 실 HTTP cross-repo 범위는 kpubdata#282.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  // @real-builder 스펙(실 Builder 기동 필요)은 기본 슈트에서 제외한다.
  grep: /^(?!.*@real-builder).*$/,
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
