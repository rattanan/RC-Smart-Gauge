import { describe, it, expect, vi, afterEach } from "vitest";
import { demoPacket, parsePacket, isFresh, type Reading } from "./telemetry";
import { demoTiming } from "./demo";
import { acceptMemory, storeMode } from "./store";
import { createSession, validSession, sameSecret } from "./auth";
import { boundedJson, sameOrigin } from "./http";
const now = 1_800_000_000_000;
const packet = () => ({ ...demoPacket(100), sent_at_ms: now });
afterEach(() => vi.unstubAllEnvs());
describe("telemetry contract", () => {
  it("preserves missing sensors and negative steering", () => {
    const p = parsePacket({ ...packet(), steering: -0.65 }, now);
    expect(p.speed_mps).toBeNull();
    expect(p.battery_v).toBeNull();
    expect(p.steering).toBe(-0.65);
  });
  it.each([NaN, Infinity, -1.01, 1.01, ".2"])(
    "rejects invalid throttle %s",
    (throttle) =>
      expect(() => parsePacket({ ...packet(), throttle }, now)).toThrow(),
  );
  it("rejects unsafe sequence and unknown fields", () => {
    expect(() => parsePacket({ ...packet(), seq: 2 ** 54 }, now)).toThrow();
    expect(() => parsePacket({ ...packet(), secret: "leak" }, now)).toThrow();
  });
  it("rejects delayed and future-dated packets", () => {
    expect(() =>
      parsePacket({ ...packet(), sent_at_ms: now - 30001 }, now),
    ).toThrow();
    expect(() =>
      parsePacket({ ...packet(), sent_at_ms: now + 30001 }, now),
    ).toThrow();
  });
  it("does not count invalid, old, or future receipts as fresh", () => {
    const r = { packet: packet(), receivedAt: now };
    expect(isFresh(r, now + 1499)).toBe(true);
    expect(isFresh(r, now + 1500)).toBe(false);
    expect(isFresh(r, now - 1)).toBe(false);
    expect(
      isFresh({ ...r, packet: { ...r.packet, signal_valid: false } }, now),
    ).toBe(false);
  });
});
describe("atomic acceptance reference", () => {
  const state = (): {
    reading: Reading | null;
    retired: Map<string, number>;
    limits: Map<string, { count: number; until: number }>;
  } => ({
    reading: null,
    retired: new Map<string, number>(),
    limits: new Map(),
  });
  it("rejects duplicate sequence and capture timestamps without changing a gauge", () => {
    const s = state();
    expect(acceptMemory(s, packet(), now)).toBe("accepted");
    expect(acceptMemory(s, { ...packet(), steering: 1 }, now + 200)).toBe(
      "order",
    );
    expect(s.reading?.packet.steering).toBe(packet().steering);
    expect(acceptMemory(s, { ...packet(), seq: 3 }, now + 400)).toBe("order");
  });
  it("accepts a new boot and rejects its retired predecessor", () => {
    const s = state();
    acceptMemory(s, packet(), now);
    expect(
      acceptMemory(
        s,
        { ...packet(), boot_id: "boot2", seq: 0, t_capture_us: 0 },
        now + 200,
      ),
    ).toBe("accepted");
    expect(
      acceptMemory(s, { ...packet(), seq: 8, t_capture_us: 800000 }, now + 400),
    ).toBe("retired");
  });
  it("rate limits accepted senders without mutating state", () => {
    const s = state();
    acceptMemory(s, packet(), now);
    expect(
      acceptMemory(s, { ...packet(), seq: 5, t_capture_us: 500000 }, now + 50),
    ).toBe("rate");
    expect(s.reading?.packet.seq).toBe(1);
  });
  it("never uses volatile memory in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_MEMORY_STORE", "true");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", undefined);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
    vi.stubEnv("KV_REST_API_URL", undefined);
    vi.stubEnv("KV_REST_API_TOKEN", undefined);
    expect(storeMode()).toBe("unconfigured");
  });
  it("accepts the Vercel Marketplace Redis variable names", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", undefined);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
    vi.stubEnv("KV_REST_API_URL", "https://redis.example");
    vi.stubEnv("KV_REST_API_TOKEN", "fixture-token");
    expect(storeMode()).toBe("redis");
  });
});
describe("viewer authorization", () => {
  it("verifies signed sessions and expiry", () => {
    process.env.SESSION_SECRET = "test-session-key-with-at-least-32-characters";
    const token = createSession(now);
    expect(validSession(token, now + 1)).toBe(true);
    expect(validSession(token, now + 12 * 3600000)).toBe(false);
    expect(validSession(token + "x", now)).toBe(false);
    expect(validSession(token, now - 1)).toBe(false);
  });
  it("does not accept empty or oversized secrets", () => {
    expect(sameSecret("", "")).toBe(false);
    expect(sameSecret("a".repeat(513), "a".repeat(513))).toBe(false);
    expect(sameSecret("a", "b")).toBe(false);
  });
  it("requires same-origin browser mutations", () => {
    expect(
      sameOrigin(
        new Request("https://gauge.example/api/session", {
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toBe(false);
    expect(
      sameOrigin(
        new Request("https://gauge.example/api/session", {
          headers: { origin: "https://gauge.example" },
        }),
      ),
    ).toBe(true);
  });
  it("bounds chunked bodies without trusting Content-Length", async () => {
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array(5000));
        c.close();
      },
    });
    const request = new Request("http://localhost/api/ingest", {
      method: "POST",
      body: stream,
      duplex: "half",
      headers: { "Content-Type": "application/json" },
    } as RequestInit);
    await expect(boundedJson(request)).rejects.toThrow("Body too large");
  });
});
describe("deterministic browser demo", () => {
  it("starts at confirmation using the first observation time", () => {
    expect(demoTiming(2199).current).toBeNull();
    expect(demoTiming(2200).current).toBe(200);
    expect(demoTiming(2200).laps).toHaveLength(0);
  });
  it("produces 29/28/30 second laps and keeps earliest equal best", () => {
    const t = demoTiming(176200);
    expect(t.laps.map((l) => l.duration).slice(0, 3)).toEqual([
      29000, 28000, 30000,
    ]);
    expect(t.best?.index).toBe(2);
  });
});
