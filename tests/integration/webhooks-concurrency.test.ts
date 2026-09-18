import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { POST as schoolAsaasWebhook } from "../../app/api/webhooks/asaas/route";
import { POST as platformAsaasWebhook } from "../../app/api/webhooks/platform/asaas/route";

const schoolToken = "regression-school-asaas-token";
const platformToken = "regression-platform-asaas-token";

function webhookRequest(path: string, token: string, payload: unknown) {
  return new Request("http://localhost" + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "asaas-access-token": token,
    },
    body: JSON.stringify(payload),
  });
}

test("school Asaas webhook is safe under concurrent duplicate delivery and late events", async () => {
  process.env.ASAAS_WEBHOOK_TOKEN = schoolToken;
  const suffix = randomUUID().slice(0, 8);

  const school = await prisma.school.create({
    data: {
      name: "Webhook School " + suffix,
      slug: "webhook-school-" + suffix,
      lifecycleStatus: "ACTIVE",
    },
  });
  const student = await prisma.student.create({
    data: {
      schoolId: school.id,
      registration: "WH-" + suffix,
      name: "Aluno Webhook",
      status: "ACTIVE",
    },
  });
  const paymentId = "pay-" + suffix;
  const charge = await prisma.charge.create({
    data: {
      schoolId: school.id,
      studentId: student.id,
      description: "Mensalidade webhook",
      baseAmount: 100,
      amount: 100,
      paidAmount: 0,
      dueDate: new Date("2026-09-10T12:00:00.000Z"),
      status: "PENDING",
      provider: "ASAAS",
      externalId: paymentId,
    },
  });

  try {
    const payload = {
      id: "evt-received-" + suffix,
      event: "PAYMENT_RECEIVED",
      payment: {
        id: paymentId,
        status: "RECEIVED",
        value: 100,
        paymentDate: "2026-09-10",
      },
    };

    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        schoolAsaasWebhook(
          webhookRequest("/api/webhooks/asaas", schoolToken, payload),
        ),
      ),
    );
    assert.equal(responses.every((response) => response.status === 200), true);

    const bodies = await Promise.all(responses.map((response) => response.json()));
    assert.equal(
      bodies.filter((body) => body.duplicate === true).length,
      19,
      "somente uma entrega deve processar o evento",
    );

    assert.equal(
      await prisma.paymentWebhookEvent.count({
        where: { provider: "ASAAS", eventId: payload.id },
      }),
      1,
    );
    assert.equal(
      await prisma.payment.count({
        where: { provider: "ASAAS", externalId: paymentId },
      }),
      1,
    );

    let storedCharge = await prisma.charge.findUniqueOrThrow({
      where: { id: charge.id },
    });
    assert.equal(storedCharge.status, "PAID");
    assert.equal(Number(storedCharge.paidAmount), 100);

    const lateOverdue = await schoolAsaasWebhook(
      webhookRequest("/api/webhooks/asaas", schoolToken, {
        id: "evt-overdue-" + suffix,
        event: "PAYMENT_OVERDUE",
        payment: { id: paymentId, status: "OVERDUE" },
      }),
    );
    assert.equal(lateOverdue.status, 200);
    storedCharge = await prisma.charge.findUniqueOrThrow({
      where: { id: charge.id },
    });
    assert.equal(storedCharge.status, "PAID");

    const refund = await schoolAsaasWebhook(
      webhookRequest("/api/webhooks/asaas", schoolToken, {
        id: "evt-refund-" + suffix,
        event: "PAYMENT_REFUNDED",
        payment: { id: paymentId, status: "REFUNDED" },
      }),
    );
    assert.equal(refund.status, 200);

    const lateConfirmed = await schoolAsaasWebhook(
      webhookRequest("/api/webhooks/asaas", schoolToken, {
        id: "evt-late-confirmed-" + suffix,
        event: "PAYMENT_CONFIRMED",
        payment: {
          id: paymentId,
          status: "CONFIRMED",
          value: 100,
          confirmedDate: "2026-09-10",
        },
      }),
    );
    assert.equal(lateConfirmed.status, 200);

    storedCharge = await prisma.charge.findUniqueOrThrow({
      where: { id: charge.id },
    });
    const storedPayment = await prisma.payment.findUniqueOrThrow({
      where: {
        provider_externalId: {
          provider: "ASAAS",
          externalId: paymentId,
        },
      },
    });
    assert.equal(storedCharge.status, "REFUNDED");
    assert.equal(Number(storedCharge.paidAmount), 0);
    assert.equal(storedPayment.status, "REFUNDED");
  } finally {
    await prisma.school.delete({ where: { id: school.id } }).catch(() => null);
  }
});

test("platform Asaas webhook is serialized and terminal states resist late callbacks", async () => {
  process.env.PLATFORM_ASAAS_WEBHOOK_TOKEN = platformToken;
  const suffix = randomUUID().slice(0, 8);

  const plan = await prisma.saaSPlan.create({
    data: {
      code: "WEBHOOK-" + suffix,
      name: "Webhook Plan " + suffix,
      monthlyPrice: 99,
      active: true,
    },
  });
  const school = await prisma.school.create({
    data: {
      name: "Platform Webhook " + suffix,
      slug: "platform-webhook-" + suffix,
      lifecycleStatus: "SUSPENDED",
    },
  });
  const subscription = await prisma.schoolSubscription.create({
    data: {
      schoolId: school.id,
      planId: plan.id,
      status: "PAST_DUE",
      provider: "ASAAS",
      billingInterval: "MONTHLY",
    },
  });
  const paymentId = "platform-pay-" + suffix;
  const invoice = await prisma.platformInvoice.create({
    data: {
      subscriptionId: subscription.id,
      provider: "ASAAS",
      externalId: paymentId,
      amount: 99,
      dueDate: new Date("2026-09-10T12:00:00.000Z"),
      status: "PENDING",
      periodStart: new Date("2026-09-01T12:00:00.000Z"),
      periodEnd: new Date("2026-10-01T12:00:00.000Z"),
    },
  });

  try {
    const payload = {
      id: "platform-evt-" + suffix,
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: paymentId,
        status: "CONFIRMED",
        confirmedDate: "2026-09-10",
      },
    };

    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        platformAsaasWebhook(
          webhookRequest(
            "/api/webhooks/platform/asaas",
            platformToken,
            payload,
          ),
        ),
      ),
    );
    assert.equal(responses.every((response) => response.status === 200), true);
    const bodies = await Promise.all(responses.map((response) => response.json()));
    assert.equal(
      bodies.filter((body) => body.duplicate === true).length,
      19,
    );

    let storedInvoice = await prisma.platformInvoice.findUniqueOrThrow({
      where: { id: invoice.id },
    });
    let storedSubscription = await prisma.schoolSubscription.findUniqueOrThrow({
      where: { id: subscription.id },
    });
    let storedSchool = await prisma.school.findUniqueOrThrow({
      where: { id: school.id },
    });
    assert.equal(storedInvoice.status, "PAID");
    assert.equal(storedSubscription.status, "ACTIVE");
    assert.equal(storedSchool.lifecycleStatus, "ACTIVE");

    await platformAsaasWebhook(
      webhookRequest("/api/webhooks/platform/asaas", platformToken, {
        id: "platform-overdue-" + suffix,
        event: "PAYMENT_OVERDUE",
        payment: { id: paymentId, status: "OVERDUE" },
      }),
    );
    storedInvoice = await prisma.platformInvoice.findUniqueOrThrow({
      where: { id: invoice.id },
    });
    assert.equal(storedInvoice.status, "PAID");

    await platformAsaasWebhook(
      webhookRequest("/api/webhooks/platform/asaas", platformToken, {
        id: "platform-refund-" + suffix,
        event: "PAYMENT_REFUNDED",
        payment: { id: paymentId, status: "REFUNDED" },
      }),
    );
    await platformAsaasWebhook(
      webhookRequest("/api/webhooks/platform/asaas", platformToken, {
        id: "platform-late-confirm-" + suffix,
        event: "PAYMENT_CONFIRMED",
        payment: {
          id: paymentId,
          status: "CONFIRMED",
          confirmedDate: "2026-09-10",
        },
      }),
    );

    storedInvoice = await prisma.platformInvoice.findUniqueOrThrow({
      where: { id: invoice.id },
    });
    storedSubscription = await prisma.schoolSubscription.findUniqueOrThrow({
      where: { id: subscription.id },
    });
    assert.equal(storedInvoice.status, "REFUNDED");
    assert.equal(storedSubscription.status, "PAST_DUE");
  } finally {
    await prisma.school.delete({ where: { id: school.id } }).catch(() => null);
    await prisma.saaSPlan.delete({ where: { id: plan.id } }).catch(() => null);
  }
});

test.after(async () => {
  await prisma.$disconnect();
});
