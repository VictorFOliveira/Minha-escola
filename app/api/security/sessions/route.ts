import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  destroySession,
  getSession,
} from "@/lib/session";
import { recordUserSecurityEvent } from "@/lib/security-events";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const sessions = await prisma.userSession.findMany({
    where: {
      userId: session.id,
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
      impersonatedByPlatformAdminId: true,
      supportReason: true,
    },
  });

  return NextResponse.json({
    currentSessionId: session.sessionId,
    sessions,
  });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const sessionId =
    typeof body?.sessionId === "string" ? body.sessionId : "";

  const target = await prisma.userSession.findFirst({
    where: {
      id: sessionId,
      userId: session.id,
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
    await recordUserSecurityEvent({
      schoolId: session.schoolId,
      userId: session.id,
      eventType: "SESSION_SELF_REVOKED",
      request,
    }).catch(() => null);
    await destroySession();
  } else {
    await prisma.userSession.update({
      where: { id: target.id },
      data: { revokedAt: new Date() },
    });

    await recordUserSecurityEvent({
      schoolId: session.schoolId,
      userId: session.id,
      eventType: "SESSION_REVOKED",
      request,
      metadata: { revokedSessionId: target.id },
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}
