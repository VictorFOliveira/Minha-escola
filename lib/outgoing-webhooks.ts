import { createHmac, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/security-crypto";

function retryAt(attempts: number) {
  const minutes = Math.min(360, 2 ** Math.max(0, attempts - 1));
  return new Date(Date.now() + minutes * 60 * 1000);
}

export async function emitSchoolEvent(input: {
  schoolId: string;
  eventType: string;
  payload: Record<string, unknown>;
}) {
  const webhooks = await prisma.outgoingWebhook.findMany({
    where: {
      schoolId: input.schoolId,
      active: true,
      OR: [
        { events: { has: input.eventType } },
        { events: { has: "*" } },
      ],
    },
    select: { id: true },
  });

  if (!webhooks.length) return 0;

  const eventId = randomUUID();
  const payload = JSON.parse(
    JSON.stringify({
      id: eventId,
      event: input.eventType,
      createdAt: new Date().toISOString(),
      data: input.payload,
    }),
  ) as Prisma.InputJsonValue;

  await prisma.outgoingWebhookDelivery.createMany({
    data: webhooks.map((webhook) => ({
      webhookId: webhook.id,
      eventId,
      eventType: input.eventType,
      payload,
    })),
    skipDuplicates: true,
  });

  return webhooks.length;
}

export async function processOutgoingWebhooks(limit = 100) {
  const now = new Date();
  const deliveries = await prisma.outgoingWebhookDelivery.findMany({
    where: {
      attempts: { lt: 8 },
      webhook: { active: true },
      OR: [
        { status: "PENDING" },
        {
          status: "FAILED",
          OR: [
            { nextAttemptAt: null },
            { nextAttemptAt: { lte: now } },
          ],
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { webhook: true },
  });

  let sent = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    const body = JSON.stringify(delivery.payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const secret = decryptSecret(delivery.webhook.secretEncrypted);
    const signature = createHmac("sha256", secret)
      .update(timestamp + "." + body)
      .digest("hex");

    const attempts = delivery.attempts + 1;

    try {
      const response = await fetch(delivery.webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "MinhaEscola-Webhook/1.0",
          "X-Minha-Escola-Event": delivery.eventType,
          "X-Minha-Escola-Event-Id": delivery.eventId,
          "X-Minha-Escola-Timestamp": timestamp,
          "X-Minha-Escola-Signature": "sha256=" + signature,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      await prisma.outgoingWebhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "SENT",
          attempts,
          sentAt: new Date(),
          responseCode: response.status,
          nextAttemptAt: null,
          error: null,
        },
      });
      sent += 1;
    } catch (error) {
      await prisma.outgoingWebhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "FAILED",
          attempts,
          responseCode: null,
          nextAttemptAt:
            attempts >= 8 ? null : retryAt(attempts),
          error:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "Falha de entrega.",
        },
      });
      failed += 1;
    }
  }

  return {
    processed: deliveries.length,
    sent,
    failed,
  };
}
