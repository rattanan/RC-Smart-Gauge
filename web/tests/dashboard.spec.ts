import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
const origin = "http://127.0.0.1:3000";
const headers = {
  Authorization: "Bearer local-test-device-secret-at-least-32-characters",
};
const packet = () => ({
  schema: 1,
  device_id: "rc-01",
  boot_id: randomUUID(),
  seq: 0,
  t_capture_us: 0,
  sent_at_ms: Date.now(),
  throttle: 0.38,
  steering: -0.65,
  signal_valid: true,
  source: "demo",
  speed_mps: null,
  battery_v: null,
  motor_temp_c: null,
});
test("HTTP auth, validation, latest state and reboot replay protection", async ({
  request,
}) => {
  expect((await request.get("/api/state")).status()).toBe(401);
  expect((await request.post("/api/ingest", { data: packet() })).status()).toBe(
    401,
  );
  expect(
    (
      await request.post("/api/session", {
        headers: { origin: "https://wrong.example" },
        data: { password: "local-dashboard-password-only" },
      })
    ).status(),
  ).toBe(403);
  const auth = await request.post("/api/session", {
    headers: { origin },
    data: { password: "local-dashboard-password-only" },
  });
  expect(auth.status()).toBe(200);
  expect(auth.headers()["set-cookie"]).toContain("HttpOnly");
  const p = packet();
  expect(
    (await request.post("/api/ingest", { headers, data: p })).status(),
  ).toBe(200);
  expect(
    (await request.post("/api/ingest", { headers, data: p })).status(),
  ).toBe(409);
  expect(
    (
      await request.post("/api/ingest", {
        headers,
        data: { ...p, throttle: 1.2 },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/ingest", {
        headers,
        data: { ...p, device_id: "other" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/ingest", {
        headers,
        data: { ...p, sent_at_ms: Date.now() - 31000 },
      })
    ).status(),
  ).toBe(400);
  const state = await (await request.get("/api/state")).json();
  expect(state.reading.packet.steering).toBe(-0.65);
  expect(state.reading.packet.speed_mps).toBeNull();
  await new Promise((r) => setTimeout(r, 120));
  const next = packet();
  expect(
    (await request.post("/api/ingest", { headers, data: next })).status(),
  ).toBe(200);
  expect(
    (
      await request.post("/api/ingest", {
        headers,
        data: { ...p, seq: 3, t_capture_us: 900000, sent_at_ms: Date.now() },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.post("/api/ingest", {
        headers: { Authorization: headers.Authorization.slice(7) },
        data: packet(),
      })
    ).status(),
  ).toBe(401);
});
test("desktop/mobile demo, deterministic laps, navigation and enlargement", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "SMART GAUGE", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".scene-canvas canvas")).toBeVisible();
  await page.getByRole("button", { name: "Start Session" }).click();
  await page.clock.fastForward(90000);
  await expect(page.locator(".lap-list .lap")).toHaveCount(3);
  await expect(page.locator(".best-timing strong")).toHaveText("00:28.0");
  await page.clock.runFor(100);
  await page.screenshot({
    path: "../docs/screenshots/web-drive-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Enlarge scene" }).click();
  await expect(page.locator(".drive-layout")).toHaveClass(/enlarged/);
  await expect(page.locator(".timing-strip")).toBeVisible();
  await page.getByRole("button", { name: "Restore scene" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Telemetry/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Know what the car is saying." }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Sounds/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Give the drive a voice." }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Devices/ })
    .click();
  await expect(
    page.getByRole("textbox", { name: /Paste this URL/ }),
  ).toHaveValue(`${origin}/api/ingest`);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Drive/ })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.runFor(200);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../docs/screenshots/web-drive-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("Live sign-in, ESP demo label and stale fade", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^LIVE/ }).click();
  await page
    .getByLabel("Dashboard password", { exact: true })
    .fill("local-dashboard-password-only");
  await page.getByRole("button", { name: /Open Live Drive/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const p = packet();
  expect(
    (await page.request.post("/api/ingest", { headers, data: p })).status(),
  ).toBe(200);
  await expect(page.getByText("RX CONNECTED", { exact: true })).toBeVisible();
  await expect(page.getByText(/ESP32 DEMO SOURCE/)).toBeVisible();
  await expect(page.locator(".best-timing strong")).toHaveText("—");
  await page.screenshot({
    path: "../docs/screenshots/web-drive-live.png",
    fullPage: true,
  });
  await expect(page.getByText("RX OFFLINE", { exact: true })).toBeVisible({
    timeout: 6000,
  });
  await expect(page.locator(".dial-stale")).toBeVisible();
});
