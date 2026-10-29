# RC Smart Gauge — Next.js + ESP32 internet telemetry

A separate web companion to the native Android app. Next.js 16.4.3 / React 19.3.1 / TypeScript / Three.js. The Drive screen renders original procedural 3D coupe meshes, not a screenshot used as a UI background. Dashboard controls, demo timers, sounds and responsive navigation work locally without hardware.

## Local preview

Use Node 22.14+ (Node 24 used for verification):

```powershell
cd web
npm ci
npm run dev
```

Open http://127.0.0.1:3000 . Demo is available immediately; press Start Session. Synthetic passes at 2, 31, 59 and 89 seconds produce 29/28/30-second completed laps after the 200 ms confirmation window. The session timer uses `performance.now()`. No browser demo data is uploaded.

For locally testing the internet telemetry API, run `npm run secrets` to create a **git-ignored `.env.local`** with three independent randomly generated credentials. Existing files are never overwritten and secrets are never printed. Add your own Redis REST URL/token. As an explicitly local alternative, set `ALLOW_MEMORY_STORE=true` and restart the dev server. Memory storage is rejected when `NODE_ENV=production`; Vercel always needs Redis.

## Vercel deployment

1. Import `rattanan/RC-Smart-Gauge` in Vercel. Select **Root Directory: `web`**, Framework: Next.js, Node: 24.x. Install/build commands are `npm ci` / `npm run build`; let Vercel determine the output directory.
2. Add an **Upstash Redis** database through Vercel Marketplace or your existing Upstash account. Choose a nearby region for both services. No database is provisioned automatically by this repository.
   The app also accepts the Marketplace-provided `KV_REST_API_URL` / `KV_REST_API_TOKEN` pair directly; duplicating them under the Upstash names is unnecessary. The included Vercel config selects Singapore (`sin1`).
3. In Vercel Environment Variables, add the following for Production. Read generated values privately from your local `.env.local`; do not send them through chat or commit the file.

| Variable | Purpose |
|---|---|
| `DASHBOARD_PASSWORD` | Viewer login; at least 12 characters. Generated value is 32 characters. |
| `SESSION_SECRET` | Signs 12-hour HttpOnly session cookies; at least 32 characters. |
| `DEVICE_SECRET` | Independent ESP32 Bearer secret; at least 32 characters. |
| `DEVICE_ID` | One authorized device ID, default `rc-01`; letters, digits, `_` and `-`. |
| `UPSTASH_REDIS_REST_URL` | HTTPS REST endpoint for your Redis database. |
| `UPSTASH_REDIS_REST_TOKEN` | Server-only Redis write/read token. |

Do not prefix any secret with `NEXT_PUBLIC_`. Do not set `ALLOW_MEMORY_STORE` in Vercel. Redeploy after changing environment values. Use the stable **Production URL** for ESP32, not a protected/expiring Preview URL. Vercel deployment protection must allow the device to reach `/api/ingest`; the app still requires its own Bearer secret and authenticated viewer session. The public homepage shows only browser Demo data until Live login.

4. Open the production URL → Devices. Copy its `/api/ingest` URL into ESP32 Setup. Configure the same device ID and `DEVICE_SECRET` on the board. Login to Live uses `DASHBOARD_PASSWORD`, not the device secret.
5. Send a simulator packet or use the compiled ESP32 prototype. Confirm `RX CONNECTED` and the correct source badge. Stopping the sender must show stale/offline data and silence sound.

This version supports a single shared viewer password and one paired device. It does not implement separate user accounts, tenant isolation or device provisioning. Deploy one instance per private car/group. Changing `SESSION_SECRET` revokes viewer cookies; changing `DEVICE_SECRET` revokes the old sender credential.

## Internet data path

```text
RC receiver (future confirmed adapter)
    ↓
ESP32 → Wi-Fi/router → HTTPS POST /api/ingest → Upstash Redis
                                                   ↓
User browser ← authenticated GET /api/state every 500 ms
```

All device connections are outbound; no router port forwarding is needed. The site uses short HTTP polling requests, not a permanent WebSocket inside a Vercel function. One latest reading is retained for 24 hours; this is not session/lap history storage. Device ID is checked, sequence and monotonic capture time must advance, retired boot IDs are rejected for 24 hours, and a single Redis Lua transaction performs acceptance + update. Timestamped packets must be within ±30 seconds of server wall time, so the ESP32 synchronizes NTP before uploading.

Upload default: 250 ms **after** each completed response (up to roughly 4 Hz); API cap: 10 accepted packets/s. Browser polls every 500 ms while visible, pauses when hidden and never queues overlapping fetches. RX stale threshold starts at 1500 ms. These are prototype settings requiring real internet tests. Internet delay can vary; the RC transmitter remains the only driving control.

At a 20-minute session, a 4 Hz uploader can make approximately 4,800 upload requests; one 2 Hz viewer approximately 2,400 read requests, plus sign-in. Actual upload frequency is reduced by response time. Review your Vercel/Redis quotas before continuous operation; no paid service or plan is enabled by the code.

## API contract

`POST https://your-production-domain/api/ingest`

Headers: `Content-Type: application/json`, `Authorization: Bearer <DEVICE_SECRET>`.

```javascript
{
  schema: 1,
  device_id: "rc-01",
  boot_id: "fresh-random-id-each-boot",
  seq: 1250,
  t_capture_us: 25000000,  // monotonic device clock, retained without clock mapping
  sent_at_ms: Date.now(), // current UTC epoch milliseconds; ESP32 uses NTP
  throttle: 0.38,         // calibrated command [-1, 1]
  steering: -0.65,        // left negative; right positive
  signal_valid: true,
  source: "demo",         // change to "receiver" only in a verified hardware adapter
  speed_mps: null,
  battery_v: null,
  motor_temp_c: null
}
```

Missing sensors remain null / em dash. Unknown fields, invalid ranges, non-finite values, unsafe integers, bodies over 4096 bytes and expired packets are rejected. Responses: 200 accepted, 400 invalid/expired, 401 wrong/missing Bearer, 403 wrong device, 409 duplicate/order/retired boot, 429 rate limit, 503 incomplete config/storage failure. No secret or raw request body is logged. Credentials are not returned by any endpoint. GET state/device APIs require the signed viewer cookie. Browser login/logout requires same origin; login is limited to five attempts/IP/minute using shared Redis on Vercel.

For an upload rehearsal without hardware, set `TELEMETRY_URL`, `DEVICE_SECRET`, optional `DEVICE_ID` in the shell, then run `npm run simulate`. The helper never accepts credentials as command-line arguments, follows no redirects, sends `source: demo` and drops failed frames. HTTPS is required except for loopback development.

## Representation and scope

- Demo owns the synthetic track/cars/timing. Live shows an illustrative course and cosmetic own-car pose, with no invented lead car or START sign.
- RPM/gears/audio are simulated from throttle. Steering input is not measured yaw or wheel angle.
- Live freshness conservatively combines server receipt age, request round-trip time and elapsed monotonic client time. It is not measured capture-to-display latency. Capture clocks are not mapped and network delay is not known precisely.
- Real camera video, OCR/START timing, vehicle detection, durable web sessions/CSV and physical receiver acquisition are not implemented. Live lap fields remain unavailable.
- Local browser session history resets on reload. Audio is muted on startup, tab/window switch and stale input; volume/preset preferences are stored locally.
- The new detailed procedural coupe follows the supplied visual direction: smooth body, flared arches, dark glass, detailed rims, wing, LED tails and twin exhaust. It remains a stylized original 3D model rather than an exact licensed reproduction of a branded vehicle.

## Verification

```powershell
npm test
npm run typecheck
npm run build
npm exec -- playwright test
```

On this Windows host, `npx` resolves to an unrelated System32 executable; use `npm exec -- playwright test` or `node_modules\.bin\playwright.cmd test` instead. Tests automatically use installed Chrome on Windows; elsewhere run `npm exec -- playwright install chromium` first. Browser tests start a local-only server with explicitly named fixture credentials when necessary. Do not use those fixture credentials in a deployment.

The exact Redis Lua acceptance script also has a standalone test: install `fakeredis[lua]==2.32.1` in an isolated Python environment and run `python scripts/test-redis.py`. It exercises Lua semantics locally, not an actual Upstash account. See `../docs/WEB-TEST-REPORT.md` for actual results and remaining verification limits.

Official references checked: [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers), [server-only environment variables](https://nextjs.org/docs/app/guides/environment-variables), [Upstash REST API](https://upstash.com/docs/redis/features/restapi), [Vercel Functions limits](https://vercel.com/docs/functions/limitations).
