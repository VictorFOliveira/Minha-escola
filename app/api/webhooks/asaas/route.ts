import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/finance";

type AsaasWebhook = {
  id?: string;
  event?: string;
  payment?: {
    id?: string;
    status?: string;
    value?: number;
    netValue?: number;
    paymentDate?: string;
    confirmedDate?: string;
  };
};

export async function POST(request: Request) {
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  const receivedToken = request.headers.get("asaas-access-token")?.trim();

  if (!expectedToken || receivedToken !== expectedToken) {
    return NextResponse.json({ error: "Webhook não autorizado." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as AsaasWebhook | null;
  const eventId = payload?.id || "";
  const eventType = payload?.event || "";
  const paymentId = payload?.payment?.id || "";

  if (!eventId || !eventType) {
    return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  }

  const response = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      WITH advisory_lock AS (
        SELECT pg_advisory_xact_lock(
          hashtextextended(${"asaas-event:" + eventId}, 0)
        )
      )
      SELECT 1::int AS "locked" FROM advisory_lock
    `;

    const eventRecord = await tx.paymentWebhookEvent.upsert({
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

    if (eventRecord.processedAt) {
      return { ok: true, duplicate: true };
    }

    if (!paymentId) {
      await tx.paymentWebhookEvent.update({
        where: { id: eventRecord.id },
        data: { processedAt: new Date() },
      });
      return { ok: true };
    }

    // Eventos distintos (RECEIVED/CONFIRMED/REFUNDED etc.) do mesmo
    // pagamento também precisam ser processados em sequência.
    await tx.$queryRaw`
      WITH advisory_lock AS (
        SELECT pg_advisory_xact_lock(
          hashtextextended(${"asaas-payment:" + paymentId}, 0)
        )
      )
      SELECT 1::int AS "locked" FROM advisory_lock
    `;

    const charge = await tx.charge.findFirst({
      where: {
        provider: "ASAAS",
        externalId: paymentId,
      },
    });

    if (!charge) {
      await tx.paymentWebhookEvent.update({
        where: { id: eventRecord.id },
        data: { processedAt: new Date() },
      });
      return { ok: true, unmatched: true };
    }

    if (eventType === "PAYMENT_OVERDUE") {
      // Um callback atrasado não pode rebaixar estados financeiros terminais.
      if (!["PAID", "REFUNDED", "CANCELLED"].includes(charge.status)) {
        await tx.charge.update({
          where: { id: charge.id },
          data: {
            status: "OVERDUE",
            externalStatus: payload?.payment?.status || eventType,
          },
        });
      }
    }

    if (
      eventType === "PAYMENT_RECEIVED" ||
      eventType === "PAYMENT_CONFIRMED"
    ) {
      // REFUNDED/CANCELLED são terminais até um evento explícito de restauração.
      if (!["REFUNDED", "CANCELLED"].includes(charge.status)) {
        const amount = Number(payload?.payment?.value ?? charge.amount);
        const paidAt = payload?.payment?.paymentDate
          ? new Date(payload.payment.paymentDate + "T12:00:00.000Z")
          : payload?.payment?.confirmedDate
            ? new Date(payload.payment.confirmedDate + "T12:00:00.000Z")
            : new Date();

        const existingPayment = await tx.payment.findUnique({
          where: {
            provider_externalId: {
              provider: "ASAAS",
              externalId: paymentId,
            },
          },
        });

        await tx.payment.upsert({
          where: {
            provider_externalId: {
              provider: "ASAAS",
              externalId: paymentId,
            },
          },
          update: {
            amount,
            status:
              eventType === "PAYMENT_CONFIRMED" ? "CONFIRMED" : "RECEIVED",
            paidAt,
          },
          create: {
            chargeId: charge.id,
            amount,
            method: charge.paymentMethod || "OTHER",
            provider: "ASAAS",
            status:
              eventType === "PAYMENT_CONFIRMED" ? "CONFIRMED" : "RECEIVED",
            externalId: paymentId,
            paidAt,
          },
        });

        const previousExternalAmount = existingPayment
          ? Number(existingPayment.amount)
          : 0;
        const delta = Math.max(0, amount - previousExternalAmount);
        const newPaidAmount = roundMoney(
          Number(charge.paidAmount) + delta,
        );

        await tx.charge.update({
          where: { id: charge.id },
          data: {
            paidAmount: newPaidAmount,
            paidAt:
              newPaidAmount >= Number(charge.amount) ? paidAt : charge.paidAt,
            status:
              newPaidAmount >= Number(charge.amount) ? "PAID" : "PARTIAL",
            externalStatus: payload?.payment?.status || eventType,
          },
        });
      }
    }

    if (eventType === "PAYMENT_REFUNDED") {
      await tx.payment.updateMany({
        where: { provider: "ASAAS", externalId: paymentId },
        data: { status: "REFUNDED" },
      });
      await tx.charge.update({
        where: { id: charge.id },
        data: {
          status: "REFUNDED",
          paidAmount: 0,
          paidAt: null,
          externalStatus: payload?.payment?.status || eventType,
        },
      });

      await tx.schoolDocument.updateMany({
        where: {
          chargeId: charge.id,
          type: "PAYMENT_RECEIPT",
          status: "ISSUED",
        },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: "Pagamento estornado pelo provedor.",
        },
      });
    }

    if (
      eventType === "PAYMENT_DELETED" ||
      eventType === "PAYMENT_RESTORED"
    ) {
      await tx.charge.update({
        where: { id: charge.id },
        data: {
          status:
            eventType === "PAYMENT_DELETED"
              ? "CANCELLED"
              : "PENDING",
          externalStatus: payload?.payment?.status || eventType,
        },
      });
    }

    await tx.paymentWebhookEvent.update({
      where: { id: eventRecord.id },
      data: { processedAt: new Date() },
    });

    return { ok: true };
  });

  return NextResponse.json(response);
}
