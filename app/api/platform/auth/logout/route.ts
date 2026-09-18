import { NextResponse } from "next/server";
import {
  destroyPlatformSession,
  getPlatformSession,
} from "@/lib/platform-session";
import { recordPlatformSecurityEvent } from "@/lib/security-events";

export async function POST(request: Request) {
  const session = await getPlatformSession();

  if (session) {
    await recordPlatformSecurityEvent({
      platformAdminId: session.id,
      eventType: "PLATFORM_LOGOUT",
      request,
    }).catch(() => null);
  }

  await destroyPlatformSession();
  return NextResponse.redirect(new URL("/superadmin/login", request.url), 303);
}
