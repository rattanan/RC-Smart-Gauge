export type Packet = {
  schema: 1;
  device_id: string;
  boot_id: string;
  seq: number;
  t_capture_us: number;
  sent_at_ms: number;
  throttle: number;
  steering: number;
  signal_valid: boolean;
  source: "demo" | "receiver";
  speed_mps: number | null;
  battery_v: number | null;
  motor_temp_c: number | null;
};
export type Reading = { packet: Packet; receivedAt: number };
export const STALE_MS = 1500;
export function parsePacket(value: unknown, now = Date.now()): Packet {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected an object");
  const v = value as Record<string, unknown>;
  const allowed = [
    "schema",
    "device_id",
    "boot_id",
    "seq",
    "t_capture_us",
    "sent_at_ms",
    "throttle",
    "steering",
    "signal_valid",
    "source",
    "speed_mps",
    "battery_v",
    "motor_temp_c",
  ];
  if (Object.keys(v).some((k) => !allowed.includes(k)))
    throw new Error("Unknown field");
  const number = (key: string, min: number, max: number, integer = false) => {
    const n = v[key];
    if (
      typeof n !== "number" ||
      !Number.isFinite(n) ||
      n < min ||
      n > max ||
      (integer && !Number.isSafeInteger(n))
    )
      throw new Error(`Invalid ${key}`);
    return n;
  };
  const identifier = (key: string) => {
    const s = v[key];
    if (typeof s !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(s))
      throw new Error(`Invalid ${key}`);
    return s;
  };
  const optional = (key: string, min: number, max: number) =>
    v[key] == null ? null : number(key, min, max);
  if (
    v.schema !== 1 ||
    typeof v.signal_valid !== "boolean" ||
    !["demo", "receiver"].includes(String(v.source))
  )
    throw new Error("Invalid schema, signal or source");
  const sent = number("sent_at_ms", 0, Number.MAX_SAFE_INTEGER, true);
  if (Math.abs(now - sent) > 30_000)
    throw new Error("Packet expired or clock is not synchronized");
  return {
    schema: 1,
    device_id: identifier("device_id"),
    boot_id: identifier("boot_id"),
    seq: number("seq", 0, Number.MAX_SAFE_INTEGER, true),
    t_capture_us: number("t_capture_us", 0, Number.MAX_SAFE_INTEGER, true),
    sent_at_ms: sent,
    throttle: number("throttle", -1, 1),
    steering: number("steering", -1, 1),
    signal_valid: v.signal_valid,
    source: v.source as Packet["source"],
    speed_mps: optional("speed_mps", 0, 150),
    battery_v: optional("battery_v", 0, 100),
    motor_temp_c: optional("motor_temp_c", -40, 200),
  };
}
export function isFresh(reading: Reading | null, now = Date.now()) {
  return (
    !!reading &&
    reading.packet.signal_valid &&
    now - reading.receivedAt >= 0 &&
    now - reading.receivedAt < STALE_MS
  );
}
export function demoPacket(ms: number): Packet {
  const throttle = 0.42 + 0.27 * Math.sin((ms / 1000) * 0.7);
  return {
    schema: 1,
    device_id: "rc-01",
    boot_id: "browser-demo",
    seq: Math.floor(ms / 100),
    t_capture_us: Math.floor(ms * 1000),
    sent_at_ms: Date.now(),
    throttle,
    steering: Math.sin((ms / 1000) * 0.43) * 0.85,
    signal_valid: true,
    source: "demo",
    speed_mps: null,
    battery_v: null,
    motor_temp_c: null,
  };
}
export function simulatedDrive(throttle: number) {
  const rpm = 900 + Math.abs(throttle) * 6800;
  return { rpm, gear: Math.min(4, Math.max(1, Math.floor(rpm / 2000))) };
}
