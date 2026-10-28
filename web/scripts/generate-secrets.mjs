import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
// Write to an ignored file, never print generated secrets in logs/chat.
const contents = [
  `DASHBOARD_PASSWORD=${randomBytes(24).toString("base64url")}`,
  `SESSION_SECRET=${randomBytes(32).toString("base64url")}`,
  `DEVICE_SECRET=${randomBytes(32).toString("base64url")}`,
  "DEVICE_ID=rc-01",
  "UPSTASH_REDIS_REST_URL=",
  "UPSTASH_REDIS_REST_TOKEN=",
  "ALLOW_MEMORY_STORE=false",
  "",
].join("\n");
writeFileSync(".env.local", contents, { flag: "wx", mode: 0o600 });
console.log(
  "Created ignored .env.local. Read it locally and copy its values to Vercel Environment Variables. Existing files are never overwritten.",
);
