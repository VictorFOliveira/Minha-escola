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

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${"platform-asaas-event:" + eventId}, 0)
      )
    `;

    const event = await tx.platformWebhookEvent.upsert({
      where: {
        provider_eventId: {
          provider: "ASAAS",
          eventId,
        },
      },
      update: {},
      create: {
        provider: "ASAAS",
        eventId,
        eventType,
        payload: payload as any,
      },
    });

    if (event.processedAt) {
      return {
        response: { ok: true, duplicate: true },
        audit: null,
      };
    }

    if (!paymentId) {
      await tx.platformWebhookEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      });
      return {
        response: { ok: true },
        audit: null,
      };
    }

    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${"platform-asaas-payment:" + paymentId}, 0)
      )
    `;

    const invoice = await tx.platformInvoice.findFirst({
      where: {
        provider: "ASAAS",
        externalId: paymentId,
      },
      include: {
        subscription: true,
      },
    });

    if (!invoice) {
      await tx.platformWebhookEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      });

      return {
        response: { ok: true, unmatched: true },
        audit: null,
      };
    }

    if (
      eventType === "PAYMENT_RECEIVED" ||
      eventType === "PAYMENT_CONFIRMED"
    ) {
      // Refund/cancel são terminais até um fluxo explícito de restauração.
      if (!["REFUNDED", "CANCELLED"].includes(invoice.status)) {
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
    }

    if (eventType === "PAYMENT_OVERDUE") {
      if (!["PAID", "REFUNDED", "CANCELLED"].includes(invoice.status)) {
        await tx.platformInvoice.update({
          where: { id: invoice.id },
          data: { status: "OVERDUE" },
        });

        await tx.schoolSubscription.update({
          where: { id: invoice.subscriptionId },
          data: { status: "PAST_DUE" },
        });
      }
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

    return {
      response: { ok: true },
      audit: {
        schoolId: invoice.subscription.schoolId,
        invoiceId: invoice.id,
      },
    };
  });

  if (result.audit) {
    await auditSystemAction({
      schoolId: result.audit.schoolId,
      action: "PLATFORM_BILLING_WEBHOOK",
      entityType: "PlatformInvoice",
      entityId: result.audit.invoiceId,
      metadata: { eventId, eventType },
    }).catch(() => null);
  }

  return NextResponse.json(result.response);
}
