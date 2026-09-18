import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platform-session";
import { createSession } from "@/lib/session";
import { hasSchoolFeature } from "@/lib/features";
import { auditPlatformAction } from "@/lib/audit";
import {
  recordPlatformSecurityEvent,
  recordUserSecurityEvent,
} from "@/lib/security-events";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const platform = await getPlatformSession();

  if (!platform || !platform.mfaVerified) {
    return NextResponse.json(
      { error: "Superadmin autenticado com MFA é obrigatório." },
      { status: 401 },
    );
  }

  const { id: schoolId } = await context.params;
  const body = await request.json().catch(() => null);
  const reason =
    typeof body?.reason === "string" ? body.reason.trim() : "";

  if (reason.length < 10) {
    return NextResponse.json(
      { error: "Informe um motivo de suporte com pelo menos 10 caracteres." },
      { status: 400 },
    );
  }

  if (!(await hasSchoolFeature(schoolId, "supportImpersonation"))) {
    return NextResponse.json(
      { error: "Modo suporte não está habilitado no plano desta escola." },
      { status: 403 },
    );
  }

  const school = await prisma.school.findFirst({
    where: {
      id: schoolId,
      lifecycleStatus: { in: ["ACTIVE", "TRIAL"] },
    },
  });

  if (!school) {
    return NextResponse.json(
      { error: "Escola indisponível para modo suporte." },
      { status: 409 },
    );
  }

  const admin = await prisma.user.findFirst({
    where: {
      schoolId,
      role: "ADMIN",
      active: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!admin) {
    return NextResponse.json(
      { error: "A escola não possui ADMIN ativo." },
      { status: 409 },
    );
  }

  await createSession(
    {
      id: admin.id,
      schoolId: school.id,
      schoolName: school.name,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      enrollmentId: admin.enrollmentId,
      guardianId: admin.guardianId,
      teacherId: admin.teacherId,
    },
    {
      request,
      mfaVerified: true,
      impersonatedByPlatformAdminId: platform.id,
      supportReason: reason,
    },
  );

  await Promise.all([
    auditPlatformAction({
      platformAdminId: platform.id,
      schoolId,
      action: "SUPPORT_IMPERSONATION_START",
      entityType: "User",
      entityId: admin.id,
      metadata: { reason },
    }).catch(() => null),
    recordPlatformSecurityEvent({
      platformAdminId: platform.id,
      schoolId,
      eventType: "SUPPORT_IMPERSONATION_START",
      severity: "WARN",
      request,
      metadata: { targetUserId: admin.id, reason },
    }).catch(() => null),
    recordUserSecurityEvent({
      schoolId,
      userId: admin.id,
      eventType: "SUPPORT_SESSION_STARTED",
      severity: "WARN",
      request,
      metadata: { platformAdminId: platform.id, reason },
    }).catch(() => null),
  ]);

  return NextResponse.json({
    ok: true,
    homePath: "/dashboard",
  });
}
