import { cookies } from "next/headers";
import { COOKIE_NAME, validSession } from "@/lib/auth";
import { json } from "@/lib/http";
import { latestReading, storeMode } from "@/lib/store";
export const runtime = "nodejs";
export async function GET() {
  if (!validSession((await cookies()).get(COOKIE_NAME)?.value))
    return json({ error: "Sign in to view live telemetry" }, 401);
  try {
    return json({
      reading: await latestReading(),
      serverNow: Date.now(),
      storage: storeMode(),
    });
  } catch {
    return json({ error: "Telemetry storage unavailable" }, 503);
  }
}
