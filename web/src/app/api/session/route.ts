import { cookies } from "next/headers";
import {
  COOKIE_NAME,
  authenticationConfigured,
  createSession,
  sameSecret,
  validSession,
} from "@/lib/auth";
import { boundedJson, json, sameOrigin } from "@/lib/http";
import { allowLogin, storeMode } from "@/lib/store";
export const runtime = "nodejs";
export async function GET() {
  const signedIn = validSession((await cookies()).get(COOKIE_NAME)?.value);
  return json({
    signedIn,
    configured: authenticationConfigured() && storeMode() !== "unconfigured",
  });
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Invalid origin" }, 403);
  if (!authenticationConfigured() || storeMode() === "unconfigured")
    return json(
      {
        error:
          "Live mode needs the server environment variables. Demo is available now.",
      },
      503,
    );
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!(await allowLogin(ip)))
      return json(
        { error: "Too many attempts. Try again in one minute." },
        429,
      );
    const data = (await boundedJson(request, 1024)) as { password?: unknown };
    if (
      typeof data.password !== "string" ||
      !sameSecret(data.password, process.env.DASHBOARD_PASSWORD!)
    )
      return json({ error: "Incorrect dashboard password" }, 401);
    (await cookies()).set(COOKIE_NAME, createSession(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 12 * 3600,
      path: "/",
    });
    return json({ ok: true });
  } catch {
    return json({ error: "Sign-in unavailable" }, 503);
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Invalid origin" }, 403);
  (await cookies()).delete(COOKIE_NAME);
  return json({ ok: true });
}
