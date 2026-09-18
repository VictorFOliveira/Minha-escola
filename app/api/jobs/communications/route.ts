import { NextResponse } from "next/server";
import { processCommunicationDeliveries } from "@/lib/communication-delivery";
import { processOutgoingWebhooks } from "@/lib/outgoing-webhooks";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization") || "";
  return Boolean(secret) && auth === "Bearer " + secret;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const [communication, webhooks] = await Promise.all([
    processCommunicationDeliveries(100),
    processOutgoingWebhooks(100),
  ]);

  return NextResponse.json({
    ok: true,
    communication,
    webhooks,
  });
}
