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

  const existing = await prisma.paymentWebhookEvent.findUnique({
    where: {
      provider_eventId: {
        provider: "ASAAS",
        eventId,
      },
    },
  });

  if (existing?.processedAt) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const eventRecord =
    existing ||
    (await prisma.paymentWebhookEvent.create({
      data: {
        provider: "ASAAS",
        eventId,
        eventType,
        payload: payload as any,
      },
    }));

  if (!paymentId) {
    await prisma.paymentWebhookEvent.update({
      where: { id: eventRecord.id },
      data: { processedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  const charge = await prisma.charge.findFirst({
    where: {
      provider: "ASAAS",
      externalId: paymentId,
    },
  });

  if (!charge) {
    await prisma.paymentWebhookEvent.update({
      where: { id: eventRecord.id },
      data: { processedAt: new Date() },
    });
    return NextResponse.json({ ok: true, unmatched: true });
  }

  await prisma.$transaction(async (tx) => {
    if (eventType === "PAYMENT_OVERDUE") {
      await tx.charge.update({
        where: { id: charge.id },
        data: {
          status: "OVERDUE",
          externalStatus: payload?.payment?.status || eventType,
        },
      });
    }

    if (
      eventType === "PAYMENT_RECEIVED" ||
      eventType === "PAYMENT_CONFIRMED"
    ) {
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
  });

  return NextResponse.json({ ok: true });
}
