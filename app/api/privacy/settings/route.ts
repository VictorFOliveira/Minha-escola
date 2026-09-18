import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { auditUserAction } from "@/lib/audit";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const settings = await prisma.privacySettings.findUnique({
    where: { schoolId: session.schoolId },
  });

  return NextResponse.json({
    settings:
      settings || {
        academicRetentionYears: 10,
        financialRetentionYears: 5,
        auditRetentionDays: 730,
        allowPortalRequests: true,
      },
  });
}

export async function PUT(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const academicRetentionYears = Number(body?.academicRetentionYears);
  const financialRetentionYears = Number(body?.financialRetentionYears);
  const auditRetentionDays = Number(body?.auditRetentionDays);

  if (
    !Number.isInteger(academicRetentionYears) ||
    academicRetentionYears < 1 ||
    academicRetentionYears > 50 ||
    !Number.isInteger(financialRetentionYears) ||
    financialRetentionYears < 1 ||
    financialRetentionYears > 50 ||
    !Number.isInteger(auditRetentionDays) ||
    auditRetentionDays < 30 ||
    auditRetentionDays > 3650
  ) {
    return NextResponse.json(
      { error: "Política de retenção inválida." },
      { status: 400 },
    );
  }

  const settings = await prisma.privacySettings.upsert({
    where: { schoolId: session.schoolId },
    update: {
      academicRetentionYears,
      financialRetentionYears,
      auditRetentionDays,
      allowPortalRequests: body?.allowPortalRequests !== false,
    },
    create: {
      schoolId: session.schoolId,
      academicRetentionYears,
      financialRetentionYears,
      auditRetentionDays,
      allowPortalRequests: body?.allowPortalRequests !== false,
    },
  });

  await auditUserAction({
    schoolId: session.schoolId,
    userId: session.id,
    action: "PRIVACY_SETTINGS_UPDATE",
    entityType: "PrivacySettings",
    entityId: settings.id,
    metadata: {
      academicRetentionYears,
      financialRetentionYears,
      auditRetentionDays,
      allowPortalRequests: settings.allowPortalRequests,
    },
  }).catch(() => null);

  return NextResponse.json({ settings });
}
