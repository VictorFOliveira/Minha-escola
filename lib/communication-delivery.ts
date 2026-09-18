import { prisma } from "@/lib/prisma";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function retryAt(attempts: number) {
  const minutes = Math.min(60 * 6, 5 * 2 ** Math.max(0, attempts - 1));
  return new Date(Date.now() + minutes * 60 * 1000);
}

async function sendResendEmail(input: {
  deliveryId: string;
  to: string;
  subject: string;
  content: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY/EMAIL_FROM não configurados.");
  }

  const appUrl = process.env.APP_URL?.trim();
  const portalHint = appUrl
    ? '<p style="margin-top:24px"><a href="' +
      escapeHtml(appUrl) +
      '">Acessar Minha Escola</a></p>'
    : "";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
      "Idempotency-Key": "communication-delivery/" + input.deliveryId,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html:
        "<div style=\"font-family:Arial,sans-serif;line-height:1.6\">" +
        "<h2>" +
        escapeHtml(input.subject) +
        "</h2><p>" +
        escapeHtml(input.content).replaceAll("\n", "<br/>") +
        "</p>" +
        portalHint +
        "</div>",
    }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
        data.message ||
        "Falha ao enviar e-mail pelo Resend.",
    );
  }

  return data.id || null;
}

async function sendMetaWhatsApp(input: {
  to: string;
  subject: string;
  content: string;
}) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION?.trim();
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME?.trim();
  const languageCode =
    process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "pt_BR";

  if (!token || !phoneNumberId || !graphVersion || !templateName) {
    throw new Error(
      "Configuração da Meta WhatsApp Cloud API incompleta.",
    );
  }

  const to = input.to.replace(/\D/g, "");
  if (!to) throw new Error("Telefone do destinatário inválido.");

  const response = await fetch(
    "https://graph.facebook.com/" +
      encodeURIComponent(graphVersion) +
      "/" +
      encodeURIComponent(phoneNumberId) +
      "/messages",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: input.subject.slice(0, 120),
                },
                {
                  type: "text",
                  text: input.content.slice(0, 900),
                },
              ],
            },
          ],
        },
      }),
    },
  );

  const data = (await response.json().catch(() => ({}))) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
        "Falha ao enviar mensagem pela Meta WhatsApp Cloud API.",
    );
  }

  return data.messages?.[0]?.id || null;
}

export async function processCommunicationDeliveries(limit = 100) {
  const now = new Date();

  const deliveries = await prisma.communicationDelivery.findMany({
    where: {
      channel: { in: ["EMAIL", "WHATSAPP"] },
      attempts: { lt: 5 },
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
    include: {
      recipient: {
        include: {
          communication: {
            include: {
              school: {
                include: {
                  communicationSettings: true,
                },
              },
            },
          },
        },
      },
    },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const delivery of deliveries) {
    const communication = delivery.recipient.communication;
    const settings = communication.school.communicationSettings;
    const destination = delivery.destination?.trim() || "";
    const attempts = delivery.attempts + 1;

    try {
      if (!destination) {
        await prisma.communicationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "SKIPPED",
            attempts,
            lastAttemptAt: now,
            error: "Destinatário sem endereço para o canal.",
          },
        });
        skipped += 1;
        continue;
      }

      let providerId: string | null = null;

      if (delivery.channel === "EMAIL") {
        if (!settings?.emailEnabled) {
          await prisma.communicationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: "SKIPPED",
              attempts,
              lastAttemptAt: now,
              error: "Canal de e-mail desativado.",
            },
          });
          skipped += 1;
          continue;
        }

        if ((settings.emailProvider || "").toUpperCase() !== "RESEND") {
          throw new Error(
            "Provedor de e-mail não suportado. Configure RESEND.",
          );
        }

        providerId = await sendResendEmail({
          deliveryId: delivery.id,
          to: destination,
          subject: communication.title,
          content: communication.content,
        });
      } else {
        if (!settings?.whatsappEnabled) {
          await prisma.communicationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: "SKIPPED",
              attempts,
              lastAttemptAt: now,
              error: "Canal de WhatsApp desativado.",
            },
          });
          skipped += 1;
          continue;
        }

        if (
          (settings.whatsappProvider || "").toUpperCase() !==
          "META_CLOUD"
        ) {
          throw new Error(
            "Provedor de WhatsApp não suportado. Configure META_CLOUD.",
          );
        }

        providerId = await sendMetaWhatsApp({
          to: destination,
          subject: communication.title,
          content: communication.content,
        });
      }

      await prisma.communicationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "SENT",
          providerId,
          sentAt: new Date(),
          attempts,
          lastAttemptAt: new Date(),
          nextAttemptAt: null,
          error: null,
        },
      });

      sent += 1;
    } catch (error) {
      await prisma.communicationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "FAILED",
          attempts,
          lastAttemptAt: new Date(),
          nextAttemptAt: attempts >= 5 ? null : retryAt(attempts),
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
    skipped,
  };
}
