# Vercel deployment — 29 October 2026

- Project: `rattanan-s-projects/rc-smart-gauge`
- Production URL: https://rc-smart-gauge.vercel.app
- GitHub project root: `web`; Node 24.x, Next.js.
- Upstash resource: `rc-smart-gauge-telemetry`, free plan, Singapore, paid auto-upgrade disabled.
- Marketplace injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`; the server accepts these or the documented `UPSTASH_REDIS_REST_*` variables.
- Both repository-root and web-root Vercel manifests select Singapore to support CLI deployment from the repository root and Git builds rooted at `web`.
- `.vercelignore` excludes local environment files, SDKs, Android build artifacts and dependencies from CLI uploads.

The first public deployment serves the Demo successfully (HTTP 200). Live remains disabled until the app's dashboard/session/device credentials are explicitly approved and configured in Production Environment Variables. Credentials must not be committed or printed. Local credentials were generated in ignored `web/.env.local` for private owner access.

Do not paste the ESP32 device secret into browser login: Live login uses `DASHBOARD_PASSWORD`. Device uploads use `DEVICE_SECRET` in the Authorization header and the stable production `/api/ingest` URL.
