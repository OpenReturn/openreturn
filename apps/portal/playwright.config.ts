import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } }
  ],
  webServer: {
    command:
      "pnpm -r --filter './packages/*' build && USE_IN_MEMORY_DB=true OPENRETURN_API_BASE_URL=http://127.0.0.1:4000 NEXT_PUBLIC_OPENRETURN_API_BASE_URL=http://127.0.0.1:4000 pnpm --parallel --filter @openreturn/api --filter @openreturn/portal dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true
  }
});
