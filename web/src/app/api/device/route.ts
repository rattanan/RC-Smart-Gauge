import { cookies } from "next/headers";
import { COOKIE_NAME, validSession } from "@/lib/auth";
import { json } from "@/lib/http";
import { storeMode } from "@/lib/store";
export async function GET() {
  if (!validSession((await cookies()).get(COOKIE_NAME)?.value))
    return json({ error: "Unauthorized" }, 401);
  return json({
    deviceId: process.env.DEVICE_ID || "rc-01",
    storage: storeMode(),
  });
}
