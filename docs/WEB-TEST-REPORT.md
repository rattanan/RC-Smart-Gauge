# Web / ESP32 verification — 28 October 2026

## Implemented

- Separate Next.js web companion under `web/`, with a responsive Drive dashboard, original detailed procedural 3D coupe, Demo/Live source selection, timing/history, synthetic sound and Devices setup guidance.
- HTTPS ingestion endpoint with an independent device secret, bounded schema validation, timestamp expiry and atomic Redis sequence/boot/rate checks.
- Viewer password login, signed HttpOnly session cookie, origin checks and shared login attempt limits.
- Serverless-compatible Redis REST storage. Development memory mode is explicit and refused in production.
- ESP32 SoftAP provisioning for Wi-Fi, complete URL, device secret, ID, CA and interval. NVS persistence, verified TLS, NTP, no redirects, no backlog and bounded retry.

## Actual verification

- Production Next.js build succeeds; all four API routes compile as dynamic server handlers.
- TypeScript check passes.
- 19 unit tests pass for ranges/nulls, freshness, timestamp expiry, order/rate/boot handling, session signatures, origin protection, chunked-body bounds and deterministic demo laps.
- 9 Redis Lua checks pass using the exact production script inside local fakeredis/Lua. This verifies script behavior without claiming an actual Upstash deployment test.
- 3 Chrome end-to-end tests pass: HTTP authorization/validation/reboot handling, desktop/mobile Demo + 29/28/30-second laps + navigation/enlargement, and viewer login + live synthetic packet + stale transition.
- Visual checks at desktop 1440×1000 and mobile 390×844. Fixed observed SVG floating-point hydration mismatch, mobile overflow, dial clipping and local-origin canonicalization. Fresh browser probe reports no page/console errors and no horizontal overflow.
- `npm audit --omit=dev --audit-level=high` reports zero vulnerabilities at verification time.
- ESP32 reference target compiles successfully with espressif32 6.12.0 / Arduino 2.0.17 / ArduinoJson 7.4.2. Final compiler reports 47,304 bytes RAM and 945,041 bytes flash, including the Serial newline handling adjustment.
- Verified the Windows CA-export helper against a trusted HTTPS certificate chain. This does not verify the future Vercel domain or the ESP32's live TLS connection.

Actual screenshots: `screenshots/web-drive-desktop.png`, `web-drive-mobile.png`, `web-drive-live.png`.

## Limits / deployment state

- Vercel CLI initially reported logged out. An account sign-in request was opened; production deployment and a user-owned Upstash database require account connection/configuration. No production URL, deployed secret or external hardware result is claimed by local tests.
- The local preview uses clearly named test-only credentials and explicit volatile memory storage. Those fixture credentials are never deployment defaults.
- ESP32 firmware has not been flashed or run on hardware. It emits labeled DEMO data without GPIO assignment. Real receiver/board/voltage, Wi-Fi range, TLS chain, power and rate measurements are unverified.
- The detailed coupe is original procedural geometry. It follows the provided image direction but is not a scanned/licensed replica or a claim of photoreal asset fidelity.
- Live mode has no camera/OCR/detector, verified metric distance, speed inference, measured drift pose or live lap timing. No steering, braking or autonomous control outputs exist.
- Browser audio startup/stale logic is exercised functionally; audio quality, latency, FPS, heat and long-duration reliability remain unmeasured. Browser tests use SwiftShader software rendering.
