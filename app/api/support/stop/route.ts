import { NextResponse } from "next/server";
import { destroySession, getSession } from "@/lib/session";
import { auditPlatformAction } from "@/lib/audit";
import {
  recordPlatformSecurityEvent,
  recordUserSecurityEvent,
} from "@/lib/security-events";

export async function POST(request: Request) {
  const session = await getSession();

  if (!session?.impersonatedByPlatformAdminId) {
    return NextResponse.redirect(new URL("/dashboard", request.url), 303);
  }

  const platformAdminId = session.impersonatedByPlatformAdminId;

  await Promise.all([
    auditPlatformAction({
      platformAdminId,
      schoolId: session.schoolId,
      action: "SUPPORT_IMPERSONATION_STOP",
      entityType: "User",
      entityId: session.id,
      metadata: { reason: session.supportReason || null },
    }).catch(() => null),
    recordPlatformSecurityEvent({
      platformAdminId,
      schoolId: session.schoolId,
      eventType: "SUPPORT_IMPERSONATION_STOP",
      request,
    }).catch(() => null),
    recordUserSecurityEvent({
      schoolId: session.schoolId,
      userId: session.id,
      eventType: "SUPPORT_SESSION_ENDED",
      request,
    }).catch(() => null),
  ]);

  await destroySession();

  return NextResponse.redirect(new URL("/superadmin", request.url), 303);
}
