import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 40000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    viewport: { width: 1440, height: 1000 },
    headless: true,
    launchOptions: existsSync(chrome)
      ? {
          executablePath: chrome,
          args: [
            "--enable-webgl",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
          ],
        }
      : {},
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 60000,
    env: {
      DASHBOARD_PASSWORD: "local-dashboard-password-only",
      SESSION_SECRET: "local-test-session-secret-at-least-32-characters",
      DEVICE_SECRET: "local-test-device-secret-at-least-32-characters",
      ALLOW_MEMORY_STORE: "true",
    },
  },
});
