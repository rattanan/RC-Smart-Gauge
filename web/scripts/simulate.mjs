// Sends explicit synthetic telemetry. Secrets are read from environment, never arguments.
import { randomUUID } from "node:crypto";
const endpoint = process.env.TELEMETRY_URL;
const secret = process.env.DEVICE_SECRET;
if (!endpoint || !secret)
  throw new Error(
    "Set TELEMETRY_URL and DEVICE_SECRET in your shell environment",
  );
const url = new URL(endpoint);
if (
  url.protocol !== "https:" &&
  !["localhost", "127.0.0.1"].includes(url.hostname)
)
  throw new Error("Use HTTPS outside local development");
const boot_id = randomUUID();
let seq = 0;
const start = performance.now();
console.log("Sending labeled DEMO telemetry. Ctrl+C stops the sender.");
while (true) {
  const t = performance.now() - start;
  const payload = {
    schema: 1,
    device_id: process.env.DEVICE_ID || "rc-01",
    boot_id,
    seq: seq++,
    t_capture_us: Math.floor(t * 1000),
    sent_at_ms: Date.now(),
    throttle: 0.42 + 0.27 * Math.sin((t / 1000) * 0.7),
    steering: Math.sin((t / 1000) * 0.43) * 0.85,
    signal_valid: true,
    source: "demo",
    speed_mps: null,
    battery_v: null,
    motor_temp_c: null,
  };
  try {
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) console.error(`Upload status: ${response.status}`);
  } catch {
    console.error("Upload unavailable; dropping this frame");
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
