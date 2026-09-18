import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditSystemAction } from "@/lib/audit";

type WebhookPayload = {
  id?: string;
  event?: string;
  payment?: {
    id?: string;
    status?: string;
    paymentDate?: string;
    confirmedDate?: string;
  };
};

export async function POST(request: Request) {
  const expected = process.env.PLATFORM_ASAAS_WEBHOOK_TOKEN?.trim();
  const received = request.headers.get("asaas-access-token")?.trim();

  if (!expected || received !== expected) {
    return NextResponse.json({ error: "Webhook não autorizado." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as
    | WebhookPayload
    | null;

  const eventId = payload?.id || "";
  const eventType = payload?.event || "";
  const paymentId = payload?.payment?.id || "";

  if (!eventId || !eventType) {
    return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  }

  let event = await prisma.platformWebhookEvent.findUnique({
    where: {
      provider_eventId: {
        provider: "ASAAS",
        eventId,
      },
    },
  });

  if (event?.processedAt) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (!event) {
    event = await prisma.platformWebhookEvent.create({
      data: {
        provider: "ASAAS",
        eventId,
        eventType,
        payload: payload as any,
      },
    });
  }

  if (!paymentId) {
    await prisma.platformWebhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  const invoice = await prisma.platformInvoice.findFirst({
    where: {
      provider: "ASAAS",
      externalId: paymentId,
    },
    include: {
      subscription: true,
    },
  });

  if (!invoice) {
    await prisma.platformWebhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    });

    return NextResponse.json({ ok: true, unmatched: true });
  }

  await prisma.$transaction(async (tx) => {
    if (
      eventType === "PAYMENT_RECEIVED" ||
      eventType === "PAYMENT_CONFIRMED"
    ) {
      const paidAt = payload?.payment?.paymentDate
        ? new Date(payload.payment.paymentDate + "T12:00:00.000Z")
        : payload?.payment?.confirmedDate
          ? new Date(payload.payment.confirmedDate + "T12:00:00.000Z")
          : new Date();

      await tx.platformInvoice.update({
        where: { id: invoice.id },
        data: {
          status: "PAID",
          paidAt,
        },
      });

      await tx.schoolSubscription.update({
        where: { id: invoice.subscriptionId },
        data: {
          status: "ACTIVE",
          currentPeriodStart: invoice.periodStart,
          currentPeriodEnd: invoice.periodEnd,
          nextBillingAt: invoice.periodEnd,
        },
      });

      await tx.school.update({
        where: { id: invoice.subscription.schoolId },
        data: { lifecycleStatus: "ACTIVE" },
      });
    }

    if (eventType === "PAYMENT_OVERDUE") {
      await tx.platformInvoice.update({
        where: { id: invoice.id },
        data: { status: "OVERDUE" },
      });

      await tx.schoolSubscription.update({
        where: { id: invoice.subscriptionId },
        data: { status: "PAST_DUE" },
      });
    }

    if (eventType === "PAYMENT_REFUNDED") {
      await tx.platformInvoice.update({
        where: { id: invoice.id },
        data: {
          status: "REFUNDED",
          paidAt: null,
        },
      });

      await tx.schoolSubscription.update({
        where: { id: invoice.subscriptionId },
        data: { status: "PAST_DUE" },
      });
    }

    if (eventType === "PAYMENT_DELETED") {
      await tx.platformInvoice.update({
        where: { id: invoice.id },
        data: { status: "CANCELLED" },
      });
    }

    await tx.platformWebhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    });
  });

  await auditSystemAction({
    schoolId: invoice.subscription.schoolId,
    action: "PLATFORM_BILLING_WEBHOOK",
    entityType: "PlatformInvoice",
    entityId: invoice.id,
    metadata: { eventId, eventType },
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
