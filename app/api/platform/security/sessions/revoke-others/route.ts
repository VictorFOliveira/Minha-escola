import { NextResponse } from "next/server";
import {
  getPlatformSession,
  revokeAllPlatformSessions,
} from "@/lib/platform-session";
import { recordPlatformSecurityEvent } from "@/lib/security-events";

export async function POST(request: Request) {
  const session = await getPlatformSession();

  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  await revokeAllPlatformSessions(session.id, session.sessionId);

  await recordPlatformSecurityEvent({
    platformAdminId: session.id,
    eventType: "PLATFORM_OTHER_SESSIONS_REVOKED",
    request,
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
