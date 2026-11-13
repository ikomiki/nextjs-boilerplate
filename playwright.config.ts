/// <reference types="node" />
import { defineConfig, devices } from "@playwright/test";

const apps = [
  { name: "counter-indexed-db-app", port: 3001 },
  { name: "counter-memory-app", port: 3002 },
  { name: "counter-sqlite-app", port: 3003 },
];

export default defineConfig({
  testDir: "e2e",
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
  webServer: apps.map((app) => ({
    command: `bun run --cwd apps/${app.name} dev`,
    port: app.port,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  })),
});
