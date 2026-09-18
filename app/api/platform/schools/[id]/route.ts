import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platform-session";
import { auditPlatformAction } from "@/lib/audit";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const session = await getPlatformSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await context.params;
  const school = await prisma.school.findUnique({
    where: { id },
  });

  if (!school) {
    return NextResponse.json(
      { error: "Escola não encontrada." },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => null);
  const lifecycleStatus = [
    "ONBOARDING",
    "TRIAL",
    "ACTIVE",
    "SUSPENDED",
    "CANCELLED",
  ].includes(body?.lifecycleStatus)
    ? body.lifecycleStatus
    : undefined;

  const planId =
    typeof body?.planId === "string" && body.planId
      ? body.planId
      : undefined;
  const billingProvider = ["MANUAL", "ASAAS"].includes(body?.provider)
    ? body.provider
    : undefined;
  const billingInterval = ["MONTHLY", "ANNUAL"].includes(body?.billingInterval)
    ? body.billingInterval
    : undefined;

  const subscriptionStatus = [
    "TRIAL",
    "ACTIVE",
    "PAST_DUE",
    "SUSPENDED",
    "CANCELLED",
  ].includes(body?.subscriptionStatus)
    ? body.subscriptionStatus
    : undefined;

  if (lifecycleStatus) {
    await prisma.school.update({
      where: { id },
      data: { lifecycleStatus },
    });
  }

  if (planId) {
    const plan = await prisma.saaSPlan.findFirst({
      where: { id: planId, active: true },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plano inválido." },
        { status: 400 },
      );
    }

    const trialEndsAt = body?.trialEndsAt
      ? new Date(String(body.trialEndsAt) + "T23:59:59.000Z")
      : null;

    await prisma.schoolSubscription.upsert({
      where: { schoolId: id },
      update: {
        planId,
        ...(subscriptionStatus
          ? { status: subscriptionStatus }
          : {}),
        trialEndsAt,
        ...(billingProvider ? { provider: billingProvider } : {}),
        ...(billingInterval ? { billingInterval } : {}),
        ...(trialEndsAt ? { nextBillingAt: trialEndsAt } : {}),
      },
      create: {
        schoolId: id,
        planId,
        status: subscriptionStatus || "TRIAL",
        trialEndsAt,
        provider: billingProvider || "MANUAL",
        billingInterval: billingInterval || "MONTHLY",
        nextBillingAt: trialEndsAt,
      },
    });
  } else if (subscriptionStatus || billingProvider || billingInterval) {
    const existing =
      await prisma.schoolSubscription.findUnique({
        where: { schoolId: id },
      });

    if (!existing) {
      return NextResponse.json(
        { error: "A escola ainda não possui assinatura." },
        { status: 409 },
      );
    }

    await prisma.schoolSubscription.update({
      where: { schoolId: id },
      data: {
        ...(subscriptionStatus ? { status: subscriptionStatus } : {}),
        ...(billingProvider ? { provider: billingProvider } : {}),
        ...(billingInterval ? { billingInterval } : {}),
      },
    });
  }

  await auditPlatformAction({
    platformAdminId: session.id,
    schoolId: id,
    action: "SCHOOL_SUBSCRIPTION_UPDATE",
    entityType: "School",
    entityId: id,
    metadata: {
      lifecycleStatus: lifecycleStatus || null,
      planId: planId || null,
      subscriptionStatus: subscriptionStatus || null,
      provider: billingProvider || null,
      billingInterval: billingInterval || null,
    },
  }).catch(() => null);

  const updated = await prisma.school.findUnique({
    where: { id },
    include: {
      subscription: {
        include: {
          plan: true,
          invoices: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      _count: {
        select: { students: true, users: true, classes: true },
      },
    },
  });

  return NextResponse.json({ school: updated });
}
