import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  destroyPlatformSession,
  getPlatformSession,
} from "@/lib/platform-session";
import { recordPlatformSecurityEvent } from "@/lib/security-events";

export async function GET() {
  const session = await getPlatformSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const sessions = await prisma.platformSession.findMany({
    where: {
      platformAdminId: session.id,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      lastSeenAt: true,
      expiresAt: true,
      userAgent: true,
      ipHash: true,
      mfaVerified: true,
    },
  });

  return NextResponse.json({
    currentSessionId: session.sessionId,
    sessions,
  });
}

export async function DELETE(request: Request) {
  const session = await getPlatformSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const sessionId =
    typeof body?.sessionId === "string" ? body.sessionId : "";

  const target = await prisma.platformSession.findFirst({
    where: {
      id: sessionId,
      platformAdminId: session.id,
      revokedAt: null,
    },
  });

  if (!target) {
    return NextResponse.json(
      { error: "Sessão não encontrada." },
      { status: 404 },
    );
  }

  if (target.id === session.sessionId) {
    await recordPlatformSecurityEvent({
      platformAdminId: session.id,
      eventType: "PLATFORM_SESSION_SELF_REVOKED",
      request,
    }).catch(() => null);
    await destroyPlatformSession();
  } else {
    await prisma.platformSession.update({
      where: { id: target.id },
      data: { revokedAt: new Date() },
    });

    await recordPlatformSecurityEvent({
      platformAdminId: session.id,
      eventType: "PLATFORM_SESSION_REVOKED",
      request,
      metadata: { revokedSessionId: target.id },
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}
