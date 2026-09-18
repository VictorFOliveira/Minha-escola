import { NextResponse } from "next/server";
import { destroySession, getSession } from "@/lib/session";
import { recordUserSecurityEvent } from "@/lib/security-events";

export async function POST(request: Request) {
  const session = await getSession();

  if (session) {
    await recordUserSecurityEvent({
      schoolId: session.schoolId,
      userId: session.id,
      eventType: "LOGOUT",
      request,
    }).catch(() => null);
  }

  await destroySession();
  return NextResponse.json({ ok: true });
}
