import { authenticationConfigured, sameSecret } from "@/lib/auth";
import { boundedJson, json } from "@/lib/http";
import { acceptReading, storeMode } from "@/lib/store";
import { parsePacket } from "@/lib/telemetry";
export const runtime = "nodejs";
export const maxDuration = 10;
export async function POST(request: Request) {
  if (!authenticationConfigured() || storeMode() === "unconfigured")
    return json({ error: "Server not configured" }, 503);
  const authorization = request.headers.get("authorization") || "";
  if (
    !authorization.startsWith("Bearer ") ||
    !sameSecret(authorization.slice(7), process.env.DEVICE_SECRET!)
  )
    return json({ error: "Unauthorized" }, 401);
  let packet;
  try {
    packet = parsePacket(await boundedJson(request));
  } catch {
    return json(
      { error: "Invalid, expired or oversized telemetry packet" },
      400,
    );
  }
  if (packet.device_id !== (process.env.DEVICE_ID || "rc-01"))
    return json({ error: "Device not authorized" }, 403);
  try {
    const result = await acceptReading(packet);
    if (result === "rate")
      return json({ error: "Maximum 10 packets per second" }, 429);
    if (result !== "accepted")
      return json(
        { error: "Duplicate, reordered or retired-boot packet" },
        409,
      );
    return json({ ok: true, seq: packet.seq });
  } catch {
    return json({ error: "Telemetry storage unavailable" }, 503);
  }
}
