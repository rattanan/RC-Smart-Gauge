# Vercel deployment — 29 October 2026

- Project: `rattanan-s-projects/rc-smart-gauge`
- Production URL: https://rc-smart-gauge.vercel.app
- GitHub project root: `web`; Node 24.x, Next.js.
- Upstash resource: `rc-smart-gauge-telemetry`, free plan, Singapore, paid auto-upgrade disabled.
- Marketplace injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`; the server accepts these or the documented `UPSTASH_REDIS_REST_*` variables.
- Both repository-root and web-root Vercel manifests select Singapore to support CLI deployment from the repository root and Git builds rooted at `web`.
- `.vercelignore` excludes local environment files, SDKs, Android build artifacts and dependencies from CLI uploads.

Production is deployed and Live configuration is enabled. The owner explicitly approved storing the app's dashboard/session/device credentials as sensitive Production Environment Variables. Credentials were passed through stdin and were not printed or committed. The owner can read their corresponding local values privately in ignored `web/.env.local`.

Verified against the public production URL on 29 October 2026: homepage 200; anonymous state 401; viewer login 200; authenticated telemetry upload 200; duplicate upload 409; authenticated state read 200 with actual Redis persistence; logout 200. Test traffic was labeled `source: demo`, and the final packet marked its synthetic receiver signal invalid. Physical ESP32 hardware remains unverified.

Production deployment `dpl_HL5PZ6rmhqqz7R6yJ4uzGUPryn4r` reached READY. Vercel inspection confirmed functions in `sin1` (Singapore). The connected Git repository can deploy subsequent commits automatically.

Do not paste the ESP32 device secret into browser login: Live login uses `DASHBOARD_PASSWORD`. Device uploads use `DEVICE_SECRET` in the Authorization header and the stable production `/api/ingest` URL.
