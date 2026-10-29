import { createHash } from "node:crypto";
import type { Packet, Reading } from "./telemetry";

export type AcceptResult = "accepted" | "order" | "retired" | "rate";
export const INGEST_LUA = `
local previous = redis.call('GET', KEYS[1])
local incoming = cjson.decode(ARGV[1])
if redis.call('EXISTS', KEYS[2]) == 1 then return 'retired' end
if previous then
  local old = cjson.decode(previous)
  if old.packet.boot_id == incoming.packet.boot_id and
    (incoming.packet.seq <= old.packet.seq or incoming.packet.t_capture_us <= old.packet.t_capture_us) then return 'order' end
  if incoming.receivedAt - old.receivedAt < 100 then return 'rate' end
  if old.packet.boot_id ~= incoming.packet.boot_id then
    redis.call('SET', ARGV[2] .. old.packet.boot_id, '1', 'EX', 86400)
  end
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', 86400)
return 'accepted'`;
type MemoryState = {
  reading: Reading | null;
  retired: Map<string, number>;
  limits: Map<string, { count: number; until: number }>;
};
const globalStore = globalThis as typeof globalThis & {
  rcMemory?: MemoryState;
};
const memory = () =>
  (globalStore.rcMemory ??= {
    reading: null,
    retired: new Map(),
    limits: new Map(),
  });
function redisCredentials() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
    return { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN };
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
    return { url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN };
  return null;
}
export function storeMode(): "redis" | "development-memory" | "unconfigured" {
  if (redisCredentials()) return "redis";
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_MEMORY_STORE === "true"
  )
    return "development-memory";
  return "unconfigured";
}
async function redis<T>(command: (string | number)[]): Promise<T> {
  const credentials = redisCredentials();
  if (!credentials) throw new Error("Redis not configured");
  const base = credentials.url;
  if (!base.startsWith("https://")) throw new Error("Redis requires HTTPS");
  const response = await fetch(base, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
    signal: AbortSignal.timeout(4500),
  });
  if (!response.ok) throw new Error("Storage unavailable");
  const result = (await response.json()) as { result: T; error?: string };
  if (result.error) throw new Error("Storage command failed");
  return result.result;
}
function latestKey() {
  return `rcsg:{${process.env.DEVICE_ID || "rc-01"}}:latest`;
}
export function acceptMemory(
  state: MemoryState,
  packet: Packet,
  now: number,
): AcceptResult {
  for (const [boot, until] of state.retired)
    if (until < now) state.retired.delete(boot);
  if (state.retired.has(packet.boot_id)) return "retired";
  const old = state.reading;
  if (old) {
    if (
      old.packet.boot_id === packet.boot_id &&
      (packet.seq <= old.packet.seq ||
        packet.t_capture_us <= old.packet.t_capture_us)
    )
      return "order";
    if (now - old.receivedAt < 100) return "rate";
    if (old.packet.boot_id !== packet.boot_id)
      state.retired.set(old.packet.boot_id, now + 86400000);
  }
  state.reading = { packet, receivedAt: now };
  return "accepted";
}
export async function acceptReading(
  packet: Packet,
  now = Date.now(),
): Promise<AcceptResult> {
  const mode = storeMode();
  if (mode === "development-memory") return acceptMemory(memory(), packet, now);
  if (mode !== "redis") throw new Error("Storage not configured");
  const retiredPrefix = `rcsg:{${packet.device_id}}:retired:`;
  return redis<AcceptResult>([
    "EVAL",
    INGEST_LUA,
    2,
    latestKey(),
    retiredPrefix + packet.boot_id,
    JSON.stringify({ packet, receivedAt: now }),
    retiredPrefix,
  ]);
}
export async function latestReading(): Promise<Reading | null> {
  const mode = storeMode();
  if (mode === "development-memory") return memory().reading;
  if (mode !== "redis") throw new Error("Storage not configured");
  const raw = await redis<string | null>(["GET", latestKey()]);
  return raw ? (JSON.parse(raw) as Reading) : null;
}
export async function allowLogin(ip: string) {
  const key = `rcsg:login:${createHash("sha256").update(ip).digest("hex")}`;
  if (storeMode() === "redis") {
    const count = await redis<number>([
      "EVAL",
      "local n = redis.call('INCR',KEYS[1]); if n == 1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
      1,
      key,
    ]);
    return count <= 5;
  }
  if (storeMode() !== "development-memory")
    throw new Error("Storage not configured");
  const limits = memory().limits;
  const now = Date.now();
  for (const [k, v] of limits) if (v.until < now) limits.delete(k);
  const value = limits.get(key) ?? { count: 0, until: now + 60000 };
  value.count++;
  limits.set(key, value);
  return value.count <= 5;
}
