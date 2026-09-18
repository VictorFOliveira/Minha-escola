import { NextResponse } from "next/server";
import {
  getSession,
  revokeAllUserSessions,
} from "@/lib/session";
import { recordUserSecurityEvent } from "@/lib/security-events";

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  await revokeAllUserSessions(session.id, session.sessionId);

  await recordUserSecurityEvent({
    schoolId: session.schoolId,
    userId: session.id,
    eventType: "OTHER_SESSIONS_REVOKED",
    request,
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
