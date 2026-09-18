import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isAsaasConfigured } from "@/lib/asaas";
import { auditUserAction } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "FINANCE"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const settings = await prisma.financeSettings.findUnique({
    where: { schoolId: session.schoolId },
  });

  return NextResponse.json({
    settings:
      settings || {
        schoolId: session.schoolId,
        provider: "MANUAL",
        gatewayEnabled: false,
        externalPaymentUrl: null,
        sendBillingToGuardian: true,
        sendReportToGuardian: true,
      },
    asaasConfigured: isAsaasConfigured(),
  });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas ADMIN pode alterar a integração financeira." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const provider = ["MANUAL", "ASAAS", "EXTERNAL"].includes(body?.provider)
    ? body.provider
    : "MANUAL";
  const gatewayEnabled = Boolean(body?.gatewayEnabled);

  if (provider === "ASAAS" && gatewayEnabled && !isAsaasConfigured()) {
    return NextResponse.json(
      { error: "Configure ASAAS_API_KEY no servidor antes de ativar o Asaas." },
      { status: 409 },
    );
  }

  const externalPaymentUrl =
    provider === "EXTERNAL" && body?.externalPaymentUrl
      ? String(body.externalPaymentUrl).trim()
      : null;

  if (provider === "EXTERNAL" && gatewayEnabled && !externalPaymentUrl) {
    return NextResponse.json(
      { error: "Informe a URL do sistema externo de pagamentos." },
      { status: 400 },
    );
  }

  const settings = await prisma.financeSettings.upsert({
    where: { schoolId: session.schoolId },
    update: {
      provider,
      gatewayEnabled,
      externalPaymentUrl,
      sendBillingToGuardian: body?.sendBillingToGuardian !== false,
      sendReportToGuardian: body?.sendReportToGuardian !== false,
    },
    create: {
      schoolId: session.schoolId,
      provider,
      gatewayEnabled,
      externalPaymentUrl,
      sendBillingToGuardian: body?.sendBillingToGuardian !== false,
      sendReportToGuardian: body?.sendReportToGuardian !== false,
    },
  });

  await auditUserAction({
    schoolId: session.schoolId,
    userId: session.id,
    action: "FINANCE_SETTINGS_UPDATE",
    entityType: "FinanceSettings",
    entityId: settings.id,
    metadata: {
      provider: settings.provider,
      gatewayEnabled: settings.gatewayEnabled,
    },
  }).catch(() => null);

  return NextResponse.json({ settings });
}
