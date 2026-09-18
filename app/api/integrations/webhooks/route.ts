import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { assertSchoolFeature } from "@/lib/features";
import { encryptSecret, randomToken } from "@/lib/security-crypto";
import { auditUserAction } from "@/lib/audit";

const allowedEvents = [
  "*",
  "student.created",
  "enrollment.created",
  "payment.received",
  "document.issued",
  "communication.published",
  "attendance.recorded",
  "grade.updated",
];

function validHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const webhooks = await prisma.outgoingWebhook.findMany({
    where: { schoolId: session.schoolId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      url: true,
      events: true,
      active: true,
      createdAt: true,
      _count: { select: { deliveries: true } },
    },
  });

  return NextResponse.json({ webhooks });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  try {
    await assertSchoolFeature(session.schoolId, "webhooks");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recurso indisponível." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const events: string[] = Array.isArray(body?.events)
    ? Array.from(
        new Set(
          body.events.filter(
            (event: unknown): event is string =>
              typeof event === "string" && allowedEvents.includes(event),
          ),
        ),
      )
    : [];

  if (!name || !validHttpsUrl(url) || !events.length) {
    return NextResponse.json(
      { error: "Nome, URL HTTPS pública e eventos válidos são obrigatórios." },
      { status: 400 },
    );
  }

  const secret = randomToken(32);
  const webhook = await prisma.outgoingWebhook.create({
    data: {
      schoolId: session.schoolId,
      createdByUserId: session.id,
      name,
      url,
      events,
      secretEncrypted: encryptSecret(secret),
    },
  });

  await auditUserAction({
    schoolId: session.schoolId,
    userId: session.id,
    action: "WEBHOOK_CREATE",
    entityType: "OutgoingWebhook",
    entityId: webhook.id,
    metadata: { url, events },
  }).catch(() => null);

  return NextResponse.json({
    webhook: {
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
    },
    signingSecret: secret,
  }, { status: 201 });
}
