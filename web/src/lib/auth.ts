import { createHash, createHmac, timingSafeEqual } from "node:crypto";
export const COOKIE_NAME = "rcsg_session";
export function sameSecret(input: string, expected: string) {
  if (!expected || input.length > 512) return false;
  return timingSafeEqual(
    createHash("sha256").update(input).digest(),
    createHash("sha256").update(expected).digest(),
  );
}
function key() {
  const k = process.env.SESSION_SECRET;
  if (!k || k.length < 32) throw new Error("Session key not configured");
  return k;
}
export function authenticationConfigured() {
  return (
    (process.env.SESSION_SECRET?.length ?? 0) >= 32 &&
    (process.env.DASHBOARD_PASSWORD?.length ?? 0) >= 12 &&
    (process.env.DEVICE_SECRET?.length ?? 0) >= 32
  );
}
export function createSession(now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ exp: now + 12 * 3600_000, iat: now }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", key()).update(payload).digest("base64url")}`;
}
export function validSession(token: string | undefined, now = Date.now()) {
  try {
    if (!token || token.length > 512) return false;
    const pieces = token.split(".");
    if (pieces.length !== 2) return false;
    const [payload, signature] = pieces;
    if (
      !sameSecret(
        signature,
        createHmac("sha256", key()).update(payload).digest("base64url"),
      )
    )
      return false;
    const { exp, iat } = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    );
    return (
      Number.isSafeInteger(exp) &&
      Number.isSafeInteger(iat) &&
      iat <= now &&
      exp > now &&
      exp - iat === 12 * 3600_000
    );
  } catch {
    return false;
  }
}
